import { IDurableOrchestrationContext } from "./classes";

/** @hidden */
export interface IFunctionContext {
    bindings: {
        [key: string]: object;
    };
    df: IDurableOrchestrationContext;
    done: IDoneCallback;
}

/** @hidden */
type IDoneCallback = (err?: unknown, result?: unknown) => void;
