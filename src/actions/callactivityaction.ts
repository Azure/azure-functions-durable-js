import { ActionType, IAction, Utils } from "../classes";

/** @hidden */
export class CallActivityAction implements IAction {
    public readonly actionType: ActionType = ActionType.CallActivity;

    constructor(public readonly functionName: string, public readonly input?: unknown) {
        Utils.throwIfEmpty(functionName, "functionName");
    }
}
