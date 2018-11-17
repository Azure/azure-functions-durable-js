import { ActionType, IAction } from "../classes";

export class CallSubOrchestratorAction implements IAction {
    public actionType: ActionType = ActionType.CallSubOrchestrator;

    constructor(
        public functionName: string,
        public instanceId: string,
        public input?: any,
    ) { }
}
