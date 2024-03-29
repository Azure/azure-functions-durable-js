import { RetryOptions } from "../RetryOptions";
import { Utils } from "../util/Utils";
import { ActionType } from "./ActionType";
import { IAction } from "./IAction";

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
