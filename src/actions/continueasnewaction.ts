import { Utils } from "../util/Utils";
import { ActionType } from "./actiontype";
import { IAction } from "./iaction";

/** @hidden */
export class ContinueAsNewAction implements IAction {
    public readonly actionType: ActionType = ActionType.ContinueAsNew;
    public readonly input: unknown;

    constructor(input: unknown) {
        this.input = Utils.processInput(input);
    }
}
