import { ActionType, IAction } from "../classes";

/** @hidden */
export class CallSubOrchestratorAction implements IAction {
    public readonly actionType: ActionType = ActionType.CallSubOrchestrator;

    constructor(
        public readonly functionName: string,
        public readonly instanceId: string,
        public readonly input?: unknown,
    ) { }
}
