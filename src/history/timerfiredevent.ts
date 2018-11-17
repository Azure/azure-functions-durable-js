import { HistoryEvent, HistoryEventOptions, HistoryEventType } from "../classes";

export class TimerFiredEvent extends HistoryEvent {
    public TimerId: number;
    public FireAt: Date;

    constructor(
        options: HistoryEventOptions,
    ) {
        super(
            HistoryEventType.TimerFired,
            options.eventId,
            options.isPlayed,
            options.timestamp,
        );

        this.TimerId = options.timerId;
        this.FireAt = options.fireAt;
    }
}