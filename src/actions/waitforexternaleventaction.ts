import { ActionType, IAction, Utils } from "../classes";

/** @hidden */
export class WaitForExternalEventAction implements IAction {
    public readonly actionType: ActionType = ActionType.WaitForExternalEvent;

    constructor(
        public readonly externalEventName: string,
    ) {
        Utils.throwIfEmpty(externalEventName, "externalEventName");
    }
}
