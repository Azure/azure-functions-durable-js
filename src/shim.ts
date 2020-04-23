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
export function orchestrator(
    fn: (context: IOrchestrationFunctionContext) => Generator<unknown, unknown, any>
): (context: IOrchestrationFunctionContext) => void {
    const listener = new Orchestrator(fn).listen();
    return (context: IOrchestrationFunctionContext): void => {
        listener(context);
    };
}

export function entity(
    fn: (context: IEntityFunctionContext) => unknown
): (context: IEntityFunctionContext) => void {
    const listener = new Entity(fn).listen();
    return async (context: IEntityFunctionContext): Promise<void> => {
        await listener(context);
    };
}
