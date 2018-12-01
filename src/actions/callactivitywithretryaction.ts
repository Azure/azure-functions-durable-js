import { ActionType, IAction, RetryOptions } from "../classes";

/** @hidden */
export class CallActivityWithRetryAction implements IAction {
    public readonly actionType: ActionType = ActionType.CallActivityWithRetry;

    constructor(
        public readonly functionName: string,
        public readonly retryOptions: RetryOptions,
        public readonly input?: unknown,
    ) {
        if (!retryOptions) {
            throw new TypeError(`retryOptions: expected type RetryOptions but got ${typeof retryOptions}`);
        }
    }
}
