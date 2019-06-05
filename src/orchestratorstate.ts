import { IAction, IOrchestratorState } from "./classes";

/** @hidden */
export class OrchestratorState implements IOrchestratorState {
    public readonly isDone: boolean;
    public readonly actions: IAction[][];
    public readonly output: unknown;
    public readonly error?: string;
    public readonly customStatus?: unknown;

    constructor(options: IOrchestratorState) {
        this.isDone = options.isDone;
        this.actions = options.actions;
        this.output = options.output;

        if (options.error) {
            this.error = options.error;
        }

        if (options.customStatus) {
            this.customStatus = options.customStatus;
        }
    }
}
