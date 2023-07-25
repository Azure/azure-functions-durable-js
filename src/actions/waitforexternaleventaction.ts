import { Utils } from "../util/Utils";
import { ActionType } from "./ActionType";
import { ExternalEventType } from "./ExternalEventType";
import { IAction } from "./IAction";

/** @hidden */
export class WaitForExternalEventAction implements IAction {
    public readonly actionType: ActionType = ActionType.WaitForExternalEvent;

    constructor(
        public readonly externalEventName: string,
        public readonly reason = ExternalEventType.ExternalEvent
    ) {
        Utils.throwIfEmpty(externalEventName, "externalEventName");
    }
}
