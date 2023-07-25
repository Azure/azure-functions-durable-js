import { Utils } from "../util/Utils";
import { ActionType } from "./ActionType";
import { IAction } from "./IAction";

/** @hidden */
export class CallActivityAction implements IAction {
    public readonly actionType: ActionType = ActionType.CallActivity;
    public readonly input: unknown;

    constructor(public readonly functionName: string, input?: unknown) {
        this.input = Utils.processInput(input);
        Utils.throwIfEmpty(functionName, "functionName");
    }
}
