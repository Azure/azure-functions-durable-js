import { Orchestrator } from "./orchestrator";

module.exports = (fn: GeneratorFunction) => {
    const orchestrator = new Orchestrator(fn);
    const listener = orchestrator.listen();
    return (context: any) => {
        listener(context);
    };
};
