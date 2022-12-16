import {
    app as azFuncApp,
    FunctionHandler,
    input as azFuncInput,
    trigger as azFuncTrigger,
} from "@azure/functions";
import {
    ActivityOptions,
    EntityHandler,
    DurableClientInput,
    OrchestrationHandler,
    ActivityTrigger,
    OrchestrationTrigger,
    EntityTrigger,
} from "./types";
import {
    Entity,
    EntityState,
    IEntityFunctionContext,
    IOrchestrationFunctionContext,
    Orchestrator,
} from "./classes";
import { DurableEntityBindingInfo } from "./durableentitybindinginfo";
import { OrchestratorState } from "./orchestratorstate";
import { DurableOrchestrationInput } from "./testingUtils";

type EntityFunction<T> = FunctionHandler &
    ((
        entityTrigger: DurableEntityBindingInfo,
        context: IEntityFunctionContext<T>
    ) => Promise<EntityState>);

type OrchestrationFunction = FunctionHandler &
    ((
        orchestrationTrigger: DurableOrchestrationInput,
        context: IOrchestrationFunctionContext
    ) => Promise<OrchestratorState>);

/**
 * Enables a generator function to act as an orchestrator function.
 *
 * @param fn the generator function that should act as an orchestrator
 */
export function createOrchestrator(fn: OrchestrationHandler): OrchestrationFunction {
    const listener = new Orchestrator(fn).listen();

    return async (
        orchestrationTrigger: DurableOrchestrationInput,
        context: IOrchestrationFunctionContext
    ): Promise<OrchestratorState> => {
        return await listener(context, orchestrationTrigger);
    };
}

/**
 * Enables an entity handler function to act as a Durable Entity Azure Function.
 *
 * @param fn the handler function that should act as a durable entity
 */
export function createEntityFunction<T = unknown>(fn: EntityHandler<T>): EntityFunction<T> {
    const listener = new Entity<T>(fn).listen();

    return async (
        entityTrigger: DurableEntityBindingInfo,
        context: IEntityFunctionContext<T>
    ): Promise<EntityState> => {
        return await listener(context, entityTrigger);
    };
}

export namespace app {
    /**
     * Registers a generator function as a Durable Orchestrator for your Function App.
     *
     * @param functionName the name of your new durable orchestrator
     * @param handler the generator function that should act as an orchestrator
     *
     * @example Register an orchestrator
     * ```javascript
     * const df = require("durable-functions");
     *
     * df.orchestration('durableOrchestration1', function* (context) {
     *     // orchestrator body
     * });
     * ```
     */
    export function orchestration(functionName: string, handler: OrchestrationHandler): void {
        azFuncApp.generic(functionName, {
            trigger: trigger.orchestration(),
            handler: createOrchestrator(handler),
        });
    }

    /**
     * Registers a function as a Durable Entity for your Function App.
     *
     * @param functionName the name of your new durable entity
     * @param handler the function that should act as an entity
     *
     * @example Register a counter entity
     * ```javascript
     * const df = require("durable-functions");
     *
     * df.entity('Counter', function (context) {
     *     // entity body
     * });
     * ```
     */
    export function entity<T = unknown>(functionName: string, handler: EntityHandler<T>): void {
        azFuncApp.generic(functionName, {
            trigger: trigger.entity(),
            handler: createEntityFunction(handler),
        });
    }

    /**
     * Registers a function as an Activity Function for your Function App
     *
     * @param functionName the name of your new activity function
     * @param options the configuration options for this activity,
     * specifying the handler and the inputs and outputs
     *
     * @example Register an activity function
     * ```javascript
     * const df = require("durable-functions");
     *
     * df.activity('MyActivity', {
     *   handler: function (context) {
     *      // activity body
     *   }
     * });
     * ```
     */
    export function activity(functionName: string, options: ActivityOptions): void {
        azFuncApp.generic(functionName, {
            trigger: trigger.activity(),
            ...options,
        });
    }
}

/**
 * The root namespace to help create durable trigger configurations
 */
export namespace trigger {
    /**
     * @returns a durable activity trigger
     */
    export function activity(): ActivityTrigger {
        return azFuncTrigger.generic({
            type: "activityTrigger",
        }) as ActivityTrigger;
    }

    /**
     * @returns a durable orchestration trigger
     */
    export function orchestration(): OrchestrationTrigger {
        return azFuncTrigger.generic({
            type: "orchestrationTrigger",
        }) as OrchestrationTrigger;
    }

    /**
     * @returns a durable entity trigger
     */
    export function entity(): EntityTrigger {
        return azFuncTrigger.generic({
            type: "entityTrigger",
        }) as EntityTrigger;
    }
}

/**
 * The root namespace to help create durable input configurations
 */
export namespace input {
    /**
     * @returns a durable client input configuration object
     */
    export function durableClient(): DurableClientInput {
        return azFuncInput.generic({
            type: "orchestrationClient",
        }) as DurableClientInput;
    }
}
