import { ActionType, IAction } from "../classes";

export class WaitForExternalEventAction implements IAction {
    public readonly actionType: ActionType = ActionType.WaitForExternalEvent;

    constructor(
        public readonly externalEventName: string,
    ) { }
}
