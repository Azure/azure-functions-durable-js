import { isDate } from "util";
import { ActionType } from "./actiontype";
import { IAction } from "./iaction";

/** @hidden */
export class CreateTimerAction implements IAction {
    public readonly actionType: ActionType = ActionType.CreateTimer;

    constructor(public readonly fireAt: Date, public isCanceled: boolean = false) {
        if (!isDate(fireAt)) {
            throw new TypeError(`fireAt: Expected valid Date object but got ${fireAt}`);
        }
    }
}
