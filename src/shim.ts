import {
    Entity,
    IEntityFunctionContext,
    IOrchestrationFunctionContext,
    Orchestrator,
} from "./classes";

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
export function orchestrator<T = unknown>(
    fn: (context: IOrchestrationFunctionContext<T>) => Generator<unknown, unknown, any>
): (context: IOrchestrationFunctionContext<T>) => void {
    const listener = new Orchestrator<T>(fn).listen();
    return (context): void => {
        listener(context);
    };
}

export function entity<T = unknown>(
    fn: (context: IEntityFunctionContext<T>) => void
): (context: IEntityFunctionContext<T>) => void {
    const listener = new Entity<T>(fn).listen();
    return async (context): Promise<void> => {
        await listener(context);
    };
}
