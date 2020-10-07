import { ActionType, IAction, Utils } from "../classes";

/** @hidden */
export class CallSubOrchestratorAction implements IAction {
    public readonly actionType: ActionType = ActionType.CallSubOrchestrator;
    public readonly input: unknown;

    constructor(
        public readonly functionName: string,
        public readonly instanceId?: string,
        input?: unknown
    ) {
        // If we fail to stringify inputs, they may get deserialized incorrectly.
        // For instance: "13131" might get interpreted as a number.
        // Somehow this doesn't appear to occur with other datatypes, but we should
        // investigate that further.
        if (typeof input === "string") {
            input = JSON.stringify(input);
        }
        this.input = input;
        Utils.throwIfEmpty(functionName, "functionName");

        if (instanceId) {
            Utils.throwIfEmpty(instanceId, "instanceId");
        }
    }
}
