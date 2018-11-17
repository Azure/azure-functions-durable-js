import { HistoryEvent, HistoryEventOptions, HistoryEventType } from "../classes";

export class TimerCreatedEvent extends HistoryEvent {
    public FireAt: Date;

    constructor (
        options: HistoryEventOptions,
    ) {
        super(
            HistoryEventType.TimerCreated,
            options.eventId,
            options.isPlayed,
            options.timestamp,
        );

        this.FireAt = options.fireAt;
    }
}