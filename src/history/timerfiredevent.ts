import { HistoryEvent } from "./historyevent";
import { HistoryEventOptions } from "./historyeventoptions";
import { HistoryEventType } from "./historyeventtype";

/** @hidden */
export class TimerFiredEvent extends HistoryEvent {
    public TimerId: number;
    public FireAt: Date;

    constructor(options: HistoryEventOptions) {
        super(HistoryEventType.TimerFired, options.eventId, options.isPlayed, options.timestamp);

        if (options.timerId === undefined) {
            throw new Error("TimerFiredEvent needs a timer id provided.");
        }

        if (options.fireAt === undefined) {
            throw new Error("TimerFiredEvent needs a fireAt time provided.");
        }

        this.TimerId = options.timerId;
        this.FireAt = options.fireAt;
    }
}
