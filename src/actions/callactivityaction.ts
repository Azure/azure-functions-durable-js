import { ActionType, IAction } from "../classes";

/** @hidden */
export class CallActivityAction implements IAction {
    public readonly actionType: ActionType = ActionType.CallActivity;

    constructor(
        public readonly functionName: string,
        public readonly input?: unknown,
    ) {
        if (!functionName || typeof functionName !== "string") {
            throw new TypeError(`functionName: Expected non-empty string but got ${typeof functionName}`);
        }
    }
}
