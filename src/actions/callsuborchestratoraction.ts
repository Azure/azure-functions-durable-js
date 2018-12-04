import { ActionType, IAction } from "../classes";

/** @hidden */
export class CallSubOrchestratorAction implements IAction {
    public readonly actionType: ActionType = ActionType.CallSubOrchestrator;

    constructor(
        public readonly functionName: string,
        public readonly instanceId?: string,
        public readonly input?: unknown,
    ) {
        if (!functionName || typeof functionName !== "string") {
            throw new TypeError(`functionName: Expected non-empty string but got ${typeof functionName}`);
        }

        if (instanceId && typeof instanceId !== "string") {
            throw new TypeError(`isntanceId: Expected non-empty string but got ${typeof instanceId}`);
        }
    }
}
