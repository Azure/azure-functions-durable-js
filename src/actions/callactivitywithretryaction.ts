import { Utils } from "../util/Utils";
import { RetryOptions } from "../retryoptions";
import { ActionType } from "./actiontype";
import { IAction } from "./iaction";

/** @hidden */
export class CallActivityWithRetryAction implements IAction {
    public readonly actionType: ActionType = ActionType.CallActivityWithRetry;
    public readonly input: unknown;

    constructor(
        public readonly functionName: string,
        public readonly retryOptions: RetryOptions,
        input?: unknown
    ) {
        this.input = Utils.processInput(input);
        Utils.throwIfEmpty(functionName, "functionName");

        Utils.throwIfNotInstanceOf<RetryOptions>(
            retryOptions,
            "retryOptions",
            new RetryOptions(1, 1),
            "RetryOptions"
        );
    }
}
