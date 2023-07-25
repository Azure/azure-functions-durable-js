import { IAction } from "../actions/iaction";
import { ReplaySchema } from "./ReplaySchema";

/** @hidden */
export interface IOrchestratorState {
    isDone: boolean;
    actions: IAction[][];
    output: unknown;
    error?: string;
    customStatus?: unknown;
    schemaVersion: ReplaySchema;
}
