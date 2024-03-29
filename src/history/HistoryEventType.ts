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
    EventSent = 14,
    EventRaised = 15,
    ContinueAsNew = 16,
    GenericEvent = 17,
    HistoryState = 18,
    ExecutionSuspended = 19,
    ExecutionResumed = 20,
}
