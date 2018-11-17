export enum ActionType {
    CallActivity = 0,
    CallActivityWithRetry = 1,
    CallSubOrchestrator = 2,
    CallSubOrchestratorWithRetry = 3,
    ContinueAsNew = 4,
    CreateTimer = 5,
    WaitForExternalEvent = 6,
}
