import { ActionType, IAction, RetryOptions } from "../classes";

/** @hidden */
export class CallActivityWithRetryAction implements IAction {
    public readonly actionType: ActionType = ActionType.CallActivityWithRetry;

    constructor(
        public readonly functionName: string,
        public readonly retryOptions: RetryOptions,
        public readonly input?: unknown,
    ) {
        if (!functionName || typeof functionName !== "string") {
            throw new TypeError(`functionName: Expected non-empty string but got ${typeof functionName}`);
        }

        if (!retryOptions || typeof retryOptions !== "object") {    // TODO: better type-check
            throw new TypeError(`retryOptions: expected type RetryOptions but got ${typeof retryOptions}`);
        }
    }
}
