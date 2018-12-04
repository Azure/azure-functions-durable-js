import { ActionType, IAction, RetryOptions } from "../classes";

/** @hidden */
export class CallSubOrchestratorWithRetryAction implements IAction {
    public readonly actionType: ActionType = ActionType.CallSubOrchestratorWithRetry;

    constructor(
        public readonly functionName: string,
        public readonly retryOptions: RetryOptions,
        public readonly input?: unknown,
        public readonly instanceId?: string,
    ) {
        if (!functionName || typeof functionName !== "string") {
            throw new TypeError(`functionName: Expected non-empty string but got ${typeof functionName}`);
        }

        if (!retryOptions) { // TODO: better type-check
            throw new TypeError(`retryOptions: expected type RetryOptions but got ${typeof retryOptions}`);
        }

        if (instanceId && typeof instanceId !== "string") {
            throw new TypeError(`isntanceId: Expected non-empty string but got ${typeof instanceId}`);
        }
    }
}
