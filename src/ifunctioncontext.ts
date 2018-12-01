import { DurableOrchestrationContext } from "./classes";

export interface IFunctionContext {
    bindings: {
        [key: string]: object;
    };
    df: DurableOrchestrationContext;
    done: (err?: unknown, result?: unknown) => void;
}
