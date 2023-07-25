import { DFTask } from "../task";
import { ActionType } from "./actiontype";
import { IAction } from "./iaction";

/** @hidden */
export class WhenAllAction implements IAction {
    public readonly actionType: ActionType = ActionType.WhenAll;
    public readonly compoundActions: IAction[];

    constructor(tasks: DFTask[]) {
        this.compoundActions = tasks.map((t) => t.actionObj);
    }
}
