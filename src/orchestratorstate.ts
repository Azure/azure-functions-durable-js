import { IAction, IOrchestratorState } from "./classes";
import { ReplaySchema } from "./taskorchestrationexecutor";

/** @hidden */
export class OrchestratorState implements IOrchestratorState {
    public readonly isDone: boolean;
    public readonly actions: IAction[][] | IAction[];
    public readonly output: unknown;
    public readonly error?: string;
    public readonly customStatus?: unknown;
    public readonly replaySchema: ReplaySchema | undefined;

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
        this.replaySchema = options.replaySchema !== undefined ? options.replaySchema : 0;
    }
}
