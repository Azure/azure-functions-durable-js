import { HistoryEvent, HistoryEventOptions, HistoryEventType } from "../classes";

/** @hidden */
export class EventSentEvent extends HistoryEvent {
    public Name: string;
    public Input: string | undefined;
    public InstanceId: string;

    constructor(options: HistoryEventOptions) {
        super(HistoryEventType.EventSent, options.eventId, options.isPlayed, options.timestamp);

        if (options.name === undefined) {
            throw new Error("EventSentEvent needs a name provided.");
        }

        if (options.instanceId === undefined) {
            throw new Error("EventSentEvent needs an instance id provided.");
        }

        this.Input = options.input;
        this.Name = options.name;
        this.InstanceId = options.instanceId;
    }
}
