import { ActionType, IAction } from "../classes";
import { ProperTask } from "../tasks/internalTasks";

/** @hidden */
export class WhenAnyAction implements IAction {
    public readonly actionType: ActionType = ActionType.WhenAll;
    public readonly compoundActions: IAction[];

    constructor(tasks: ProperTask[]) {
        this.compoundActions = tasks.map((t) => t.actionObj);
    }
}
