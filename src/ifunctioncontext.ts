import { IDurableOrchestrationContext } from "./classes";

export interface IFunctionContext {
    bindings: {
        [key: string]: object;
    };
    df: IDurableOrchestrationContext;
    done: IDoneCallback;
}

type IDoneCallback = (err?: unknown, result?: unknown) => void;
