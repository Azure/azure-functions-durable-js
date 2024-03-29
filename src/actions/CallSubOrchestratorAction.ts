import { Utils } from "../util/Utils";
import { ActionType } from "./ActionType";
import { IAction } from "./IAction";

/** @hidden */
export class CallSubOrchestratorAction implements IAction {
    public readonly actionType: ActionType = ActionType.CallSubOrchestrator;
    public readonly input: unknown;

    constructor(
        public readonly functionName: string,
        public readonly instanceId?: string,
        input?: unknown
    ) {
        this.input = input;
        Utils.throwIfEmpty(functionName, "functionName");

        if (instanceId) {
            Utils.throwIfEmpty(instanceId, "instanceId");
        }
    }
}
