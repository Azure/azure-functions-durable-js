import { IFunctionContext, Orchestrator } from "./classes";

export function shim(fn: (context: IFunctionContext) => IterableIterator<unknown>)
    : (context: IFunctionContext) => void {
    const orchestrator = new Orchestrator(fn);
    const listener = orchestrator.listen();
    return (context: IFunctionContext) => {
        listener(context);
    };
}
