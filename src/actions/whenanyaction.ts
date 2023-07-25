import { DFTask } from "../task";
import { ActionType } from "./actiontype";
import { IAction } from "./iaction";

/** @hidden */
export class WhenAnyAction implements IAction {
    public readonly actionType: ActionType = ActionType.WhenAny;
    public readonly compoundActions: IAction[];

    constructor(tasks: DFTask[]) {
        this.compoundActions = tasks.map((t) => t.actionObj);
    }
}
