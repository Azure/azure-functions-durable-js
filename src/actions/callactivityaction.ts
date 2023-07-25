import { Utils } from "../util/Utils";
import { ActionType } from "./actiontype";
import { IAction } from "./iaction";

/** @hidden */
export class CallActivityAction implements IAction {
    public readonly actionType: ActionType = ActionType.CallActivity;
    public readonly input: unknown;

    constructor(public readonly functionName: string, input?: unknown) {
        this.input = Utils.processInput(input);
        Utils.throwIfEmpty(functionName, "functionName");
    }
}
