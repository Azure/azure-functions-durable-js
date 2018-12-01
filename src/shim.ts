import { IFunctionContext, Orchestrator } from "./classes";

/**
 * Enables a generator function to act as an orchestrator function.
 *
 * Orchestration context methods can be acces
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
export function orchestrator(fn: (context: IFunctionContext) => IterableIterator<unknown>)
    : (context: IFunctionContext) => void {
    const orchestrator = new Orchestrator(fn);
    const listener = orchestrator.listen();
    return (context: IFunctionContext) => {
        listener(context);
    };
}
