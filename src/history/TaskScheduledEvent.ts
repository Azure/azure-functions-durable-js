import { HistoryEvent } from "./HistoryEvent";
import { HistoryEventOptions } from "./HistoryEventOptions";
import { HistoryEventType } from "./HistoryEventType";

/** @hidden */
export class TaskScheduledEvent extends HistoryEvent {
    public Name: string;
    public Input: string | undefined;

    constructor(options: HistoryEventOptions) {
        super(HistoryEventType.TaskScheduled, options.eventId, options.isPlayed, options.timestamp);

        if (options.name === undefined) {
            throw new Error("TaskScheduledEvent needs a name provided.");
        }

        this.Input = options.input;
        this.Name = options.name;
    }
}
