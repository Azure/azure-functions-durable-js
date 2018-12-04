/**
 * @hidden
 * Corresponds to subclasses of HistoryEvent type in [Durable Task framework.](https://github.com/Azure/durabletask)
 */
export enum HistoryEventType {
    ExecutionStarted = 0,
    ExecutionCompleted = 1,
    ExecutionFailed = 2,
    ExecutionTerminated = 3,
    TaskScheduled = 4,
    TaskCompleted = 5,
    TaskFailed = 6,
    SubOrchestrationInstanceCreated = 7,
    SubOrchestrationInstanceCompleted = 8,
    SubOrchestrationInstanceFailed = 9,
    TimerCreated = 10,
    TimerFired = 11,
    OrchestratorStarted = 12,
    OrchestratorCompleted = 13,
    EventRaised = 14,
    ContinueAsNew = 15,
    GenericEvent = 16,
    HistoryState = 17,
}
