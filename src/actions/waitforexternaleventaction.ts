import { ActionType, IAction } from "../classes";

/** @hidden */
export class WaitForExternalEventAction implements IAction {
    public readonly actionType: ActionType = ActionType.WaitForExternalEvent;

    constructor(
        public readonly externalEventName: string,
    ) {
        if (!externalEventName || typeof externalEventName !== "string") {
            throw new TypeError(`externalEventName: Expected non-empty string but got ${externalEventName}`);
        }
    }
}
