import { isDate } from "util";
import { ActionType, IAction } from "../classes";

/** @hidden */
export class CreateTimerAction implements IAction {
    public readonly actionType: ActionType = ActionType.CreateTimer;

    constructor(public readonly fireAt: Date, public isCancelled: boolean = false) {
        if (!isDate(fireAt)) {
            throw new TypeError(`fireAt: Expected valid Date object but got ${fireAt}`);
        }
    }
}
