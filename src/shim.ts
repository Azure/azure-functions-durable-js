import {
    Entity,
    EntityState,
    IEntityFunctionContext,
    IOrchestrationFunctionContext,
    Orchestrator,
} from "./classes";
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
): (context: IOrchestrationFunctionContext) => Promise<OrchestratorState> {
    const listener = new Orchestrator(fn).listen();
    return async (context): Promise<OrchestratorState> => {
        const orchestratorState = await listener(context);
        return orchestratorState;
    };
}

export function entity<T = unknown>(
    fn: (context: IEntityFunctionContext<T>) => void
): (context: IEntityFunctionContext<T>) => Promise<EntityState> {
    const listener = new Entity<T>(fn).listen();
    return async (context): Promise<EntityState> => {
        const entityState = await listener(context);
        return entityState;
    };
}
