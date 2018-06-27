import { Orchestrator } from "./orchestrator";

module.exports = (fn: (context: any) => IterableIterator<any>) => {
    const orchestrator = new Orchestrator(fn);
    const listener = orchestrator.listen();
    return (context: any) => {
        listener(context);
    };
};
