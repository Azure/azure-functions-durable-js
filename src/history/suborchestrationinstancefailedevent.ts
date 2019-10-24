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

        if (options.taskScheduledId === undefined) {
            throw new Error("SubOrchestrationInstanceFailedEvent needs a task scheduled id provided.");
        }

        if (options.reason === undefined) {
            throw new Error("SubOrchestrationInstanceFailedEvent needs a reason provided.");
        }

        if (options.details === undefined) {
            throw new Error("SubOrchestrationInstanceFailedEvent needs details provided.");
        }

        this.TaskScheduledId = options.taskScheduledId;
        this.Reason = options.reason;
        this.Details = options.details;
    }
}
