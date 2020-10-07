import { ActionType, IAction } from "../classes";

/** @hidden */
export class ContinueAsNewAction implements IAction {
    public readonly actionType: ActionType = ActionType.ContinueAsNew;
    public readonly input: unknown;

    constructor(input: unknown) {
        // If we fail to stringify inputs, they may get deserialized incorrectly.
        // For instance: "13131" might get interpreted as a number.
        // Somehow this doesn't appear to occur with other datatypes, but we should
        // investigate that further.
        if (typeof input === "string") {
            input = JSON.stringify(input);
        }
        this.input = input;
    }
}
