import { IAction } from "./classes";
import { UpperSchemaVersion, ReplaySchema } from "./replaySchema";

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
