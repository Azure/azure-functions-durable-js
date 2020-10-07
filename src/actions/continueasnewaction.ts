import { ActionType, IAction, Utils } from "../classes";

/** @hidden */
export class ContinueAsNewAction implements IAction {
    public readonly actionType: ActionType = ActionType.ContinueAsNew;
    public readonly input: unknown;

    constructor(input: unknown) {
        this.input = Utils.processInput(input);
    }
}
