/**
 * A specfic error thrown when a scheduled activity or suborchestrator has failed.
 * This error can be checked for via `instanceof` guards to catch only exceptions thrown
 * by the DurableJS library.
 */
export class DurableError extends Error {
    constructor(message: string | undefined) {
        super(message);
    }
}
