import { HistoryEvent, HistoryEventOptions, HistoryEventType } from "../classes";

export class TaskScheduledEvent extends HistoryEvent {
    public Name: string;
    public Input: string;

    constructor(
        options: HistoryEventOptions,
    ) {
        super(
            HistoryEventType.TaskScheduled,
            options.eventId,
            options.isPlayed,
            options.timestamp,
        );

        this.Name = options.name;
        this.Input = options.input;
    }
}