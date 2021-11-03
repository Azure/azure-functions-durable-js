import { IAction } from "./classes";
import { ReplaySchema } from "./taskorchestrationexecutor";

/** @hidden */
export interface IOrchestratorState {
    isDone: boolean;
    actions: IAction[][] | IAction[];
    output: unknown;
    error?: string;
    customStatus?: unknown;
    replaySchema?: ReplaySchema | undefined;
}
