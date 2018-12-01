import { ActionType, IAction, RetryOptions } from "../classes";

/** @hidden */
export class CallSubOrchestratorWithRetryAction implements IAction {
    public readonly actionType: ActionType = ActionType.CallSubOrchestratorWithRetry;

    constructor(
        public readonly functionName: string,
        public readonly retryOptions: RetryOptions,
        public readonly input: unknown,
        public readonly instanceId?: string,
    ) {
        if (!retryOptions) {
            throw new TypeError(`retryOptions: expected type RetryOptions but got ${typeof retryOptions}`);
        }
    }
}
