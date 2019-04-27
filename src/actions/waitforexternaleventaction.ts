import { ActionType, ExternalEventType, IAction, Utils } from "../classes";

/** @hidden */
export class WaitForExternalEventAction implements IAction {
    public readonly actionType: ActionType = ActionType.WaitForExternalEvent;

    constructor(
        public readonly externalEventName: string,
        public readonly reason: ExternalEventType,
    ) {
        Utils.throwIfEmpty(externalEventName, "externalEventName");
        Utils.throwIfEmpty(reason, "reason");
    }
}
