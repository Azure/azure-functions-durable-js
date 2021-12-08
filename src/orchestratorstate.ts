import { IAction, IOrchestratorState } from "./classes";
import { UpperSchemaVersion } from "./upperSchemaVersion";

/** @hidden */
export class OrchestratorState implements IOrchestratorState {
    public readonly isDone: boolean;
    public actions: IAction[][];
    public readonly output: unknown;
    public readonly error?: string;
    public readonly customStatus?: unknown;
    public readonly schemaVersion: UpperSchemaVersion;

    constructor(options: IOrchestratorState) {
        this.isDone = options.isDone;
        this.actions = options.actions;
        this.output = options.output;
        this.schemaVersion = options.schemaVersion;

        if (options.error) {
            this.error = options.error;
        }

        if (options.customStatus) {
            this.customStatus = options.customStatus;
        }

        // Under replay protocol V2, the actions array is flattened and then, for backwards compatibility reasons, nested within another array
        if (options.schemaVersion === UpperSchemaVersion.V2) {
            const flatActions: IAction[] = this.actions.reduce((arr, next) => arr.concat(next), []);
            this.actions = [flatActions];
        }
    }
}
