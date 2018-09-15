import { Orchestrator } from "./orchestrator";

export function shim(fn: (context: any) => IterableIterator<any>): (context: any) => void {
    const orchestrator = new Orchestrator(fn);
    const listener = orchestrator.listen();
    return (context: any) => {
        listener(context);
    };
}
