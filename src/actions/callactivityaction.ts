import { ActionType, IAction, Utils } from "../classes";

/** @hidden */
export class CallActivityAction implements IAction {
    public readonly actionType: ActionType = ActionType.CallActivity;
    public readonly input: unknown;

    constructor(public readonly functionName: string, input?: unknown) {
        this.input = Utils.processInput(input);
        Utils.throwIfEmpty(functionName, "functionName");
    }
}
