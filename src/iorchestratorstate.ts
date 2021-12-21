import { IAction } from "./classes";
import { ReplaySchema } from "./taskorchestrationexecutor";
import { UpperSchemaVersion } from "./upperSchemaVersion";

/** @hidden */
export interface IOrchestratorState {
    isDone: boolean;
    actions: IAction[][];
    output: unknown;
    error?: string;
    customStatus?: unknown;
    replaySchema?: ReplaySchema | undefined;
    schemaVersion: UpperSchemaVersion;
}
