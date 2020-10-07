import { ActionType, IAction, RetryOptions, Utils } from "../classes";

/** @hidden */
export class CallSubOrchestratorWithRetryAction implements IAction {
    public readonly actionType: ActionType = ActionType.CallSubOrchestratorWithRetry;
    public readonly input: unknown;

    constructor(
        public readonly functionName: string,
        public readonly retryOptions: RetryOptions,
        input?: unknown,
        public readonly instanceId?: string
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

        Utils.throwIfNotInstanceOf<RetryOptions>(
            retryOptions,
            "retryOptions",
            new RetryOptions(1, 1),
            "RetryOptions"
        );

        if (instanceId) {
            Utils.throwIfEmpty(instanceId, "instanceId");
        }
    }
}
