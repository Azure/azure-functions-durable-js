import { HistoryEvent, HistoryEventOptions, HistoryEventType } from "../classes";

export class SubOrchestrationInstanceCompletedEvent extends HistoryEvent {
    public TaskScheduledId: number;
    public Result: string;

    constructor(
        options: HistoryEventOptions,
    ) {
        super(
            HistoryEventType.SubOrchestrationInstanceCompleted,
            options.eventId,
            options.isPlayed,
            options.timestamp,
        );

        this.TaskScheduledId = options.taskScheduledId;
        this.Result = options.result;
    }
}