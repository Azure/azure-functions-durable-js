import { Utils } from "../util/Utils";
import { ActionType } from "./actiontype";
import { ExternalEventType } from "./externaleventtype";
import { IAction } from "./iaction";

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
