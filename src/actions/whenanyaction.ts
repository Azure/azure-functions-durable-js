import { ActionType, IAction } from "../classes";
import { DFTask } from "../task";

/** @hidden */
export class WhenAnyAction implements IAction {
    public readonly actionType: ActionType = ActionType.WhenAny;
    public readonly compoundActions: IAction[];

    constructor(tasks: DFTask[]) {
        this.compoundActions = tasks.map((t) => t.actionObj);
    }
}
