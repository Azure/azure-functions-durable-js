import { HistoryEvent } from "./HistoryEvent";
import { HistoryEventOptions } from "./HistoryEventOptions";
import { HistoryEventType } from "./HistoryEventType";

/** @hidden */
export class SubOrchestrationInstanceCompletedEvent extends HistoryEvent {
    public TaskScheduledId: number;
    public Result: string;

    constructor(options: HistoryEventOptions) {
        super(
            HistoryEventType.SubOrchestrationInstanceCompleted,
            options.eventId,
            options.isPlayed,
            options.timestamp
        );

        if (options.taskScheduledId === undefined) {
            throw new Error(
                "SubOrchestrationInstanceCompletedEvent needs a task scheduled id provided."
            );
        }

        if (options.result === undefined) {
            throw new Error("SubOrchestrationInstanceCompletedEvent needs an result provided.");
        }

        this.TaskScheduledId = options.taskScheduledId;
        this.Result = options.result;
    }
}
