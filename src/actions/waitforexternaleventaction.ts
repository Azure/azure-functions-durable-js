import { ActionType, IAction } from "../classes";

export class WaitForExternalEventAction implements IAction {
    public actionType: ActionType = ActionType.WaitForExternalEvent;

    constructor(
        public externalEventName: string,
    ) { }
}
