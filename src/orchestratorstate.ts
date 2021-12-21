import { WhenAllAction } from "./actions/whenallaction";
import { WhenAnyAction } from "./actions/whenanyaction";
import { IAction, IOrchestratorState } from "./classes";
import { UpperSchemaVersion } from "./upperSchemaVersion";

/** @hidden */
export class OrchestratorState implements IOrchestratorState {
    public readonly isDone: boolean;
    public readonly actions: IAction[][];
    public readonly output: unknown;
    public readonly error?: string;
    public readonly customStatus?: unknown;
    public readonly schemaVersion: UpperSchemaVersion;

    private flattenCompoundActions(actions: IAction[]): IAction[] {
        let v1Actions: IAction[] = [];
        for (const action of actions) {
            if (action instanceof WhenAllAction || action instanceof WhenAnyAction) {
                const innerActionArr = this.flattenCompoundActions(action.compoundActions);
                v1Actions = v1Actions.concat(innerActionArr);
            } else {
                v1Actions.push(action);
            }
        }
        return v1Actions;
    }

    constructor(options: IOrchestratorState, _literalActions = false) {
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
        // Under replay protocol V1, compound actions are treated as lists of actions.
        if (options.schemaVersion === UpperSchemaVersion.V1 && !_literalActions) {
            // for backwards compatibility, the actions array from schema V2 and onwards
            // is a 2D array with only 1 element: an array of actions.
            const actions = this.actions[0];
            const newActions: IAction[][] = [];
            // check against empty array
            if (actions !== undefined) {
                for (const action of actions) {
                    let newEntry: IAction[] = [];
                    if (action instanceof WhenAllAction || action instanceof WhenAnyAction) {
                        const innerActionArr = this.flattenCompoundActions(action.compoundActions);
                        newEntry = newEntry.concat(innerActionArr);
                    } else {
                        newEntry.push(action);
                    }
                    newActions.push(newEntry);
                }
                this.actions = newActions;
            }
        }
    }
}
