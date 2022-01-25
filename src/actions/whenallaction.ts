import { ActionType, IAction } from "../classes";
import { DFTask } from "../task";

/** @hidden */
export class WhenAllAction implements IAction {
    public readonly actionType: ActionType = ActionType.WhenAll;
    public readonly compoundActions: IAction[];

    constructor(tasks: DFTask[]) {
        this.compoundActions = tasks.map((t) => t.actionObj);
    }
}
