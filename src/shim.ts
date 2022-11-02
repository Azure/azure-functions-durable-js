import {
    Entity,
    EntityState,
    IEntityFunctionContext,
    IOrchestrationFunctionContext,
    Orchestrator,
} from "./classes";
import { DurableEntityBindingInfo } from "./durableentitybindinginfo";
import { DurableOrchestrationBindingInfo } from "./durableorchestrationbindinginfo";
import { OrchestratorState } from "./orchestratorstate";

/**
 * Enables a generator function to act as an orchestrator function.
 *
 * Orchestration context methods can be access
 * @param fn the generator function that should act as an orchestrator
 * @example Initialize an orchestrator
 * ```javascript
 * const df = require("durable-functions");
 *
 * module.exports = df.orchestrator(function*(context) {
 *     // function body
 * });
 * ```
 */
export function orchestrator(
    fn: (context: IOrchestrationFunctionContext) => Generator<unknown, unknown, any>
): (
    context: IOrchestrationFunctionContext,
    orchestrationTrigger: DurableOrchestrationBindingInfo
) => Promise<OrchestratorState> {
    const listener = new Orchestrator(fn).listen();
    return async (context, orchestrationTrigger): Promise<OrchestratorState> => {
        return await listener(context, orchestrationTrigger);
    };
}

export function entity<T = unknown>(
    fn: (context: IEntityFunctionContext<T>) => void
): (
    context: IEntityFunctionContext<T>,
    entityTrigger: DurableEntityBindingInfo
) => Promise<EntityState> {
    const listener = new Entity<T>(fn).listen();
    return async (context, entityTrigger): Promise<EntityState> => {
        return await listener(context, entityTrigger);
    };
}
