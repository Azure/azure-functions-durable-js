import { HistoryEvent, HistoryEventOptions, HistoryEventType } from "../classes";

/** @hidden */
export class TaskCompletedEvent extends HistoryEvent {
    public TaskScheduledId: number;
    public Result: string;

    constructor(options: HistoryEventOptions) {
        super(HistoryEventType.TaskCompleted, options.eventId, options.isPlayed, options.timestamp);

        if (options.taskScheduledId === undefined) {
            throw new Error("TaskCompletedEvent needs a task scheduled id provided.");
        }

        if (options.result === undefined) {
            throw new Error("TaskCompletedEvent needs a result provided.");
        }

        this.TaskScheduledId = options.taskScheduledId;
        this.Result = options.result;
    }
}
