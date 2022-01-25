import { WhenAllAction } from "./actions/whenallaction";
import { WhenAnyAction } from "./actions/whenanyaction";
import { IAction, IOrchestratorState } from "./classes";
import { ReplaySchema } from "./replaySchema";

/** @hidden */
export class OrchestratorState implements IOrchestratorState {
    public readonly isDone: boolean;
    public readonly actions: IAction[][];
    public readonly output: unknown;
    public readonly error?: string;
    public readonly customStatus?: unknown;
    public readonly schemaVersion: ReplaySchema;

    /**
     * @hidden
     *
     * It flattens an array of actions.
     * By flatten, we mean that, in the presence of a compound action (WhenAll/WhenAny),
     * we recursively extract all of its sub-actions into a flat sequence which is then
     * put in-place of the original compound action.
     *
     * For example, given the array:
     *  [Activity, Activity, WhenAll(Activity, WhenAny(ExternalEvent, Activity))]
     * We obtain:
     *  [Activity, Activity, Activity, ExternalEvent, Activity]
     *
     * This is helpful in translating the representation of user actions in
     * the DF extension replay protocol V2 to V1.
     *
     * @param actions
     *  The array of actions to flatten
     * @returns
     *  The flattened array of actions.
     */
    private flattenCompoundActions(actions: IAction[]): IAction[] {
        const flatActions: IAction[] = [];
        for (const action of actions) {
            // Given any compound action
            if (action instanceof WhenAllAction || action instanceof WhenAnyAction) {
                // We obtain its inner actions as a flat array
                const innerActionArr = this.flattenCompoundActions(action.compoundActions);
                // we concatenate the inner actions to the flat array we're building
                flatActions.push(...innerActionArr);
            } else {
                // The action wasn't compound, so it's left intact
                flatActions.push(action);
            }
        }
        return flatActions;
    }

    // literal actions is used exclusively to facilitate testing. If true, the action representation is to be left intact
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
        // Under replay protocol V1, compound actions are treated as lists of actions and
        // atomic actions are represented as a 1-element lists.
        // For example, given actions list: [Activity, WhenAny(ExternalEvent, WhenAll(Timer, Activity))]
        // The V1 protocol expects: [[Activity], [ExternalEvent, Timer, Activity]]
        if (options.schemaVersion === ReplaySchema.V1 && !_literalActions) {
            // We need to transform our V2 action representation to V1.
            // In V2, actions are represented as 2D arrays (for legacy reasons) with a singular element: an array of actions.
            const actions = this.actions[0];
            const newActions: IAction[][] = [];
            // guard against empty array, meaning no user actions were scheduled
            if (actions !== undefined) {
                for (const action of actions) {
                    // Each action is represented as an array in V1
                    const newEntry: IAction[] = [];
                    if (action instanceof WhenAllAction || action instanceof WhenAnyAction) {
                        const innerActionArr = this.flattenCompoundActions(action.compoundActions);
                        newEntry.push(...innerActionArr);
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
