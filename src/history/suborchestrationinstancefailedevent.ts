import { HistoryEvent, HistoryEventOptions, HistoryEventType } from "../classes";

/** @hidden */
export class SubOrchestrationInstanceFailedEvent extends HistoryEvent {
    public TaskScheduledId: number;
    public Reason: string;
    public Details: string;

    constructor(
        options: HistoryEventOptions,
    ) {
        super(
            HistoryEventType.SubOrchestrationInstanceFailed,
            options.eventId,
            options.isPlayed,
            options.timestamp,
        );

        this.TaskScheduledId = options.taskScheduledId;
        this.Reason = options.reason;
        this.Details = options.details;
    }
}
