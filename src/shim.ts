import { app, input as AzFuncInput, trigger as AzFuncTrigger } from "@azure/functions";
import {
    ActivityOptions,
    EntityFunction,
    EntityHandler,
    DurableClientInput,
    OrchestrationFunction,
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

/**
 * Enables a generator function to act as an orchestrator function.
 *
 * @param fn the generator function that should act as an orchestrator
 * @example Register an orchestrator using `app.generic()`
 * ```javascript
 * const { app } = require("@azure/functions")
 * const df = require("durable-functions");
 *
 * app.generic('DurableFunctionsOrchestratorJS', {
 *   trigger: trigger.generic({
 *       type: 'orchestrationTrigger'
 *   }),
 *   handler: df.createOrchestrator(function* (context) {
 *       // orchestrator body
 *  })
 * })
 * ```
 */
export function createOrchestrator(fn: OrchestrationHandler): OrchestrationFunction {
    const listener = new Orchestrator(fn).listen();

    return async (
        context: IOrchestrationFunctionContext,
        orchestrationTrigger: DurableOrchestrationInput
    ): Promise<OrchestratorState> => {
        return await listener(context, orchestrationTrigger);
    };
}

/**
 * Enables an entity handler function to act as a Durable Entity Azure Function.
 *
 * @param fn the handler function that should act as a durable entity
 * @example Register an entity using `app.generic()`
 * ```javascript
 * const { app } = require("@azure/functions")
 * const df = require("durable-functions");
 *
 * app.generic('DurableEntity', {
 *   trigger: df.trigger.entity(),
 *   handler: df.createEntityFunction(function* (context) {
 *       // orchestrator body
 *  })
 * })
 * ```
 */
export function createEntityFunction<T = unknown>(fn: EntityHandler<T>): EntityFunction<T> {
    const listener = new Entity<T>(fn).listen();

    return async (
        context: IEntityFunctionContext<T>,
        entityTrigger: DurableEntityBindingInfo
    ): Promise<EntityState> => {
        return await listener(context, entityTrigger);
    };
}

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
 * df.orchestration('DurableFunctionsOrchestratorJS', function* (context) {
 *     // orchestrator body
 * });
 * ```
 */
export function orchestration(functionName: string, handler: OrchestrationHandler): void {
    app.generic(functionName, {
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
 * df.entity('CounterEntity', function (context) {
 *     // entity body
 * });
 * ```
 */
export function entity<T = unknown>(functionName: string, handler: EntityHandler<T>): void {
    app.generic(functionName, {
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
 * @example Register an activity function with extra inputs and outputs
 * ```javascript
 * const df = require("durable-functions");
 * const { input, output } = require("@azure/functions");
 *
 * df.activity('MyActivity', {
 *   extraInputs: input.storageBlob({ path: 'test/{test}', connection: 'conn' }),
 *   extraOutputs: output.storageBlob({ path: 'test/{test}', connection: 'conn' }),
 *   handler: function (context) {
 *      // activity body
 *   }
 * });
 * ```
 */
export function activity<T = unknown>(functionName: string, options: ActivityOptions<T>): void {
    app.generic(functionName, {
        trigger: trigger.activity(),
        ...options,
    });
}

/**
 * The root namespace to help create durable trigger configurations
 */
export namespace trigger {
    /**
     * @returns a durable activity trigger
     */
    export function activity(): ActivityTrigger {
        return AzFuncTrigger.generic({
            type: "activityTrigger",
        }) as ActivityTrigger;
    }

    /**
     * @returns a durable orchestration trigger
     */
    export function orchestration(): OrchestrationTrigger {
        return AzFuncTrigger.generic({
            type: "orchestrationTrigger",
        }) as OrchestrationTrigger;
    }

    /**
     * @returns a durable entity trigger
     */
    export function entity(): EntityTrigger {
        return AzFuncTrigger.generic({
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
        return AzFuncInput.generic({
            type: "orchestrationClient",
        }) as DurableClientInput;
    }
}
