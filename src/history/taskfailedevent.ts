import { HistoryEvent, HistoryEventOptions, HistoryEventType } from "../classes";

/** @hidden */
export class TaskFailedEvent extends HistoryEvent {
    public TaskScheduledId: number;
    public Reason: string;
    public Details: string;

    constructor(
        options: HistoryEventOptions,
    ) {
        super(
            HistoryEventType.TaskFailed,
            options.eventId,
            options.isPlayed,
            options.timestamp,
        );

        if (options.taskScheduledId === undefined) {
            throw new Error("TaskFailedEvent needs a task scheduled id provided.");
        }

        if (options.reason === undefined) {
            throw new Error("TaskFailedEvent needs a reason provided.");
        }

        if (options.details === undefined) {
            throw new Error("TaskFailedEvent needs details provided.");
        }

        this.TaskScheduledId = options.taskScheduledId;
        this.Reason = options.reason;
        this.Details = options.details;
    }
}
