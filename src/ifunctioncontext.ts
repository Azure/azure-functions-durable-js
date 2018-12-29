import { DurableOrchestrationContext } from "./classes";

/**
 * Adapted from IContext in [Azure Functions' node.js worker.](https://github.com/Azure/azure-functions-nodejs-worker)
 */
export interface IFunctionContext {
    bindings: {
        [key: string]: object;
    };
    df: DurableOrchestrationContext;
    done: (err?: unknown, result?: unknown) => void;
}
