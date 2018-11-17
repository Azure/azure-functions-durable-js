import { ActionType, IAction, RetryOptions } from "../classes";

export class CallActivityWithRetryAction implements IAction {
    public actionType: ActionType = ActionType.CallActivityWithRetry;

    constructor(
        public functionName: string,
        public retryOptions: RetryOptions,
        public input?: any,
    ) {
        if (!retryOptions) {
            throw new TypeError(`retryOptions: expected type RetryOptions but got ${typeof retryOptions}`);
        }
    }
}
