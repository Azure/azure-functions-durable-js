import { ActionType, IAction, RetryOptions, Utils } from "../classes";

/** @hidden */
export class CallActivityWithRetryAction implements IAction {
    public readonly actionType: ActionType = ActionType.CallActivityWithRetry;
    public readonly input: unknown;

    constructor(
        public readonly functionName: string,
        public readonly retryOptions: RetryOptions,
        input?: unknown
    ) {
        this.input = JSON.stringify(input);
        Utils.throwIfEmpty(functionName, "functionName");

        Utils.throwIfNotInstanceOf<RetryOptions>(
            retryOptions,
            "retryOptions",
            new RetryOptions(1, 1),
            "RetryOptions"
        );
    }
}
