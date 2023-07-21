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
    OrchestrationOptions,
    EntityOptions,
    OrchestrationContext,
    EntityContext,
    RegisteredActivity,
    RegisteredOrchestration,
} from "durable-functions";
import { Entity, EntityState, Orchestrator } from "./classes";
import { DurableEntityBindingInfo } from "./durableentitybindinginfo";
import { OrchestratorState } from "./orchestratorstate";
import { DurableOrchestrationInput } from "./testingUtils";
import { RegisteredActivityTask, RegisteredOrchestrationTask } from "./task";

type EntityFunction<T> = FunctionHandler &
    ((entityTrigger: DurableEntityBindingInfo, context: EntityContext<T>) => Promise<EntityState>);

type OrchestrationFunction = FunctionHandler &
    ((
        orchestrationTrigger: DurableOrchestrationInput,
        context: OrchestrationContext
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
        context: OrchestrationContext
    ): Promise<OrchestratorState> => {
        return await listener(orchestrationTrigger, context);
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
        context: EntityContext<T>
    ): Promise<EntityState> => {
        return await listener(entityTrigger, context);
    };
}

export * as app from "./app";

export namespace trigger {
    export function activity(): ActivityTrigger {
        return azFuncTrigger.generic({
            type: "activityTrigger",
        }) as ActivityTrigger;
    }

    export function orchestration(): OrchestrationTrigger {
        return azFuncTrigger.generic({
            type: "orchestrationTrigger",
        }) as OrchestrationTrigger;
    }

    export function entity(): EntityTrigger {
        return azFuncTrigger.generic({
            type: "entityTrigger",
        }) as EntityTrigger;
    }
}

export namespace input {
    export function durableClient(): DurableClientInput {
        return azFuncInput.generic({
            type: "durableClient",
        }) as DurableClientInput;
    }
}
