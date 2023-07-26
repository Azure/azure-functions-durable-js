import { Utils } from "../util/Utils";
import { ActionType } from "./ActionType";
import { IAction } from "./IAction";

/** @hidden */
export class ContinueAsNewAction implements IAction {
    public readonly actionType: ActionType = ActionType.ContinueAsNew;
    public readonly input: unknown;

    constructor(input: unknown) {
        this.input = Utils.processInput(input);
    }
}
