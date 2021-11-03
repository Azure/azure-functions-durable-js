import { ActionType, IAction, Task, Utils } from "../classes";
import { ProperTask, TaskBase } from "../taskorchestrationexecutor";

/** @hidden */
export class WhenAnyAction implements IAction {
    public readonly actionType: ActionType = ActionType.WhenAll;
    public readonly compoundActions: IAction[];

    constructor(tasks: ProperTask[]) {
        this.compoundActions = tasks.map((t) => t.actionObj);
    }
}
