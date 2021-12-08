import { WhenAllAction } from "../actions/whenallaction";
import { WhenAnyAction } from "../actions/whenanyaction";
import { IAction } from "../classes";
import { UpperSchemaVersion } from "../upperSchemaVersion";
import { TaskBase } from "./taskinterfaces";

export type compoundActionType = "WhenAll" | "WhenAny";

/** @hidden */
export class TaskSet implements TaskBase {
    constructor(
        public readonly isCompleted: boolean,
        public readonly isFaulted: boolean,
        private readonly tasks: TaskBase[],
        private compoundActionType: compoundActionType,
        private readonly completionIndex?: number,
        public result?: unknown,
        public exception?: Error,
        private upperSchemaVersion: UpperSchemaVersion = UpperSchemaVersion.V1
    ) {}

    public yieldNewActions(): IAction[] {
        // Get all of the actions in subtasks and flatten into one array.
        const actions: IAction[] = this.tasks
            .map((task) => task.yieldNewActions())
            .reduce((actions, subTaskActions) => actions.concat(subTaskActions));
        if (this.upperSchemaVersion == UpperSchemaVersion.V1) {
            return actions;
        }

        // Under OOProc protocol V2, WhenAll and WhenAny actions are proper instead of
        // being represented as a list of sub-tasks
        let action: IAction;
        if (this.compoundActionType === "WhenAll") {
            action = new WhenAllAction(actions);
        } else {
            action = new WhenAnyAction(actions);
        }
        return [action];
    }
}
