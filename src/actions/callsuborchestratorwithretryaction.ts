import { ActionType, IAction, RetryOptions } from "../classes";

export class CallSubOrchestratorWithRetryAction implements IAction {
    public actionType: ActionType = ActionType.CallSubOrchestratorWithRetry;

    constructor(
        public functionName: string,
        public retryOptions: RetryOptions,
        public input: any,
        public instanceId?: string,
    ) {
        if (!retryOptions) {
            throw new TypeError(`retryOptions: expected type RetryOptions but got ${typeof retryOptions}`);
        }
    }
}
