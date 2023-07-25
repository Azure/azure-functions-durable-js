import { HistoryEvent } from "./historyevent";
import { HistoryEventOptions } from "./historyeventoptions";
import { HistoryEventType } from "./historyeventtype";

/** @hidden */
export class TimerCreatedEvent extends HistoryEvent {
    public FireAt: Date;

    constructor(options: HistoryEventOptions) {
        super(HistoryEventType.TimerCreated, options.eventId, options.isPlayed, options.timestamp);

        if (options.fireAt === undefined) {
            throw new Error("TimerCreatedEvent needs a fireAt time provided.");
        }

        this.FireAt = options.fireAt;
    }
}
