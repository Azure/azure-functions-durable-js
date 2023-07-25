import { HistoryEvent } from "./historyevent";
import { HistoryEventOptions } from "./historyeventoptions";
import { HistoryEventType } from "./historyeventtype";

/** @hidden */
export class TaskFailedEvent extends HistoryEvent {
    public TaskScheduledId: number;
    public Reason: string | undefined;
    public Details: string | undefined;

    constructor(options: HistoryEventOptions) {
        super(HistoryEventType.TaskFailed, options.eventId, options.isPlayed, options.timestamp);

        if (options.taskScheduledId === undefined) {
            throw new Error("TaskFailedEvent needs a task scheduled id provided.");
        }

        this.TaskScheduledId = options.taskScheduledId;
        this.Reason = options.reason;
        this.Details = options.details;
    }
}
