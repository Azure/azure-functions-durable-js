import { HistoryEventType } from "./classes";

export class HistoryEvent {
    constructor(
        public Details: string,             // SubOrchestrationInstanceFailed, TaskFailedEvent
        public EventId: number,
        public EventType: HistoryEventType,
        public FireAt: Date,                // TimerScheduled, TimerFired
        public IsPlayed: boolean = false,
        public Input: any,                  // EventRaised, ExecutionStarted,
                                            // SubOrchestrationInstanceCreated, TaskScheduled
        public InstanceId: string,          // SubOrchestrationInstanceCreated
        public Name: string,                // ExecutionStarted, SubOrchestrationInstanceCreated
        public Reason: string,              // SubOrchestrationInstanceFailed, TaskFailedEvent
        public Result: string,              // SubOrchestrationInstanceCompleted, TaskCompleted
        public TaskScheduledId: number,     // SubOrchestrationInstanceCompleted,SubOrchestrationInstanceFailed,
                                            // TaskCompleted, TaskFailed
        public TimerId: number,             // TimerFired
        public Timestamp: Date,
        public IsProcessed: boolean = false, // internal use
    ) { }
}
