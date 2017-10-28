import { Orchestrator } from "./orchestrator";

module.exports = (fn: GeneratorFunction) => {
    let orchestrator = new Orchestrator(fn);
    let listener = orchestrator.listen();
    return (context: any) => {
        listener(context);
    };
};
