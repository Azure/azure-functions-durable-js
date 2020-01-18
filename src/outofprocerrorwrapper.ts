import { OrchestratorState } from "./classes";

const outOfProcDataLabel = "\n\n$OutOfProcData$:";

export class OutOfProcErrorWrapper extends Error {
    constructor(error: Error, state: OrchestratorState) {
        const message = `${error.message}${outOfProcDataLabel}${JSON.stringify(state)}`;
        super(message);
        this.stack = error.stack;
    }
}
