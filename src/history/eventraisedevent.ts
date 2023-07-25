import { HistoryEvent } from "./historyevent";
import { HistoryEventOptions } from "./historyeventoptions";
import { HistoryEventType } from "./historyeventtype";

/** @hidden */
export class EventRaisedEvent extends HistoryEvent {
    public Name: string;
    public Input: string | undefined;

    constructor(options: HistoryEventOptions) {
        super(HistoryEventType.EventRaised, options.eventId, options.isPlayed, options.timestamp);

        if (options.name === undefined) {
            throw new Error("EventRaisedEvent needs a name provided.");
        } else {
            this.Name = options.name;
        }

        this.Input = options.input;
    }
}
