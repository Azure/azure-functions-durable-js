import { HistoryEvent, HistoryEventOptions, HistoryEventType } from "../classes";

export class EventRaisedEvent extends HistoryEvent {
    public Name: string;
    public Input: string;

    constructor(
        options: HistoryEventOptions,
    ) {
        super(
            HistoryEventType.EventRaised,
            options.eventId,
            options.isPlayed,
            options.timestamp,
        );

        this.Name = options.name;
        this.Input = options.input;
    }
}
