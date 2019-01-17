import { ActionType, IAction, RetryOptions, Utils } from "../classes";

/** @hidden */
export class CallSubOrchestratorWithRetryAction implements IAction {
    public readonly actionType: ActionType = ActionType.CallSubOrchestratorWithRetry;

    constructor(
        public readonly functionName: string,
        public readonly retryOptions: RetryOptions,
        public readonly input?: unknown,
        public readonly instanceId?: string,
    ) {
        Utils.throwIfEmpty(functionName, "functionName");

        Utils.throwIfNotInstanceOf<RetryOptions>(retryOptions, "retryOptions", new RetryOptions(1, 1), "RetryOptions");

        if (instanceId) {
            Utils.throwIfEmpty(instanceId, "instanceId");
        }
    }
}
