import { HistoryEventType } from "./classes";

export class HistoryEvent {
    constructor(
        public EventId: number,
        public EventType: HistoryEventType,
        public FireAt: Date,                // TimerScheduled, TimerFired
        public IsPlayed: boolean = false,
        public Input: any,                  // EventRaised
        public Name: string,
        public Result: string,
        public TaskScheduledId: number,     // TaskCompleted
        public TimerId: number,             // TimerFired
        public Timestamp: Date,
        public IsProcessed: boolean = false, // internal use
    ) { }
}
