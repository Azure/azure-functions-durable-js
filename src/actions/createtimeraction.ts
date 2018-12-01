import { ActionType, IAction } from "../classes";

/** @hidden */
export class CreateTimerAction implements IAction {
    public readonly actionType: ActionType = ActionType.CreateTimer;

    constructor(
        public readonly fireAt: Date,
        public isCanceled: boolean = false,
    ) { }
}
