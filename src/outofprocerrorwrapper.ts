import { OrchestratorState } from "./classes";

export class OutOfProcErrorWrapper extends Error {
    constructor(state: OrchestratorState) {
        const message = JSON.stringify(state);
        super(message);
    }
}
