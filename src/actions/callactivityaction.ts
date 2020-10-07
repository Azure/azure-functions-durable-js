import { ActionType, IAction, Utils } from "../classes";

/** @hidden */
export class CallActivityAction implements IAction {
    public readonly actionType: ActionType = ActionType.CallActivity;
    public readonly input: unknown;

    constructor(public readonly functionName: string, input?: unknown) {
        // If we fail to stringify inputs, they may get deserialized incorrectly.
        // For instance: "13131" might get interpreted as a number.
        // Somehow this doesn't appear to occur with other datatypes, but we should
        // investigate that further.
        if (input instanceof String) {
            input = JSON.stringify(input);
        }
        this.input = input;
        Utils.throwIfEmpty(functionName, "functionName");
    }
}
