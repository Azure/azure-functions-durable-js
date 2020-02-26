import { ActionType, IAction, RetryOptions, Utils } from "../classes";

/** @hidden */
export class CallActivityWithRetryAction implements IAction {
    public readonly actionType: ActionType = ActionType.CallActivityWithRetry;

    constructor(public readonly functionName: string, public readonly retryOptions: RetryOptions, public readonly input?: unknown) {
        Utils.throwIfEmpty(functionName, "functionName");

        Utils.throwIfNotInstanceOf<RetryOptions>(retryOptions, "retryOptions", new RetryOptions(1, 1), "RetryOptions");
    }
}
