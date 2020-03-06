/**
 * @hidden
 *
 * The type of asynchronous behavior the Durable Functions extension should
 * perform on behalf of the language shim. For internal use only as part of the
 * [out-of-proc execution schema.](https://github.com/Azure/azure-functions-durable-extension/wiki/Out-of-Proc-Orchestrator-Execution-Schema-Reference)
 *
 * Corresponds to internal type AsyncActionType in [Durable Functions extension.](https://github.com/Azure/azure-functions-durable-extension)
 */
export enum ActionType {
    CallActivity = 0,
    CallActivityWithRetry = 1,
    CallSubOrchestrator = 2,
    CallSubOrchestratorWithRetry = 3,
    ContinueAsNew = 4,
    CreateTimer = 5,
    WaitForExternalEvent = 6,
    CallEntity = 7,
    CallHttp = 8,
    SignalEntity = 9,
}
