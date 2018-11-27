import { IAction } from "./classes";

export interface IOrchestratorState {
    isDone: boolean;
    actions: IAction[][];
    output?: unknown;
    error?: string;
    customStatus?: unknown;
}
