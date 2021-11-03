import { ActionType, IAction, Task, Utils } from "../classes";
import { BackingAction, ProperTask, TaskBase } from "../taskorchestrationexecutor";

/** @hidden */
export class WhenAllAction implements IAction {
    public readonly actionType: ActionType = ActionType.WhenAll;
    public readonly compoundActions: IAction[];

    constructor(tasks: ProperTask[]) {
        this.compoundActions = tasks.map((t) => t.actionObj);
    }
}
