import { IAction } from "./classes";
import { UpperSchemaVersion } from "./upperSchemaVersion";

/** @hidden */
export interface IOrchestratorState {
    isDone: boolean;
    actions: IAction[][];
    output: unknown;
    error?: string;
    customStatus?: unknown;
    schemaVersion: UpperSchemaVersion;
}
