import { ActionType, IAction } from "./classes";

export class CreateTimerAction implements IAction {
    public actionType: ActionType = ActionType.CreateTimer;

    constructor(
        public fireAt: Date,
        public isCanceled: boolean = false,
    ) { }
}
