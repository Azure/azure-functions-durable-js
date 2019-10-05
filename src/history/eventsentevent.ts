import { HistoryEvent, HistoryEventOptions, HistoryEventType } from "../classes";

/** @hidden */
export class EventSentEvent extends HistoryEvent {
    public Name: string;
    public Input: string;
    public InstanceId: string;

    constructor(
        options: HistoryEventOptions,
    ) {
        super(
            HistoryEventType.EventSent,
            options.eventId,
            options.isPlayed,
            options.timestamp,
        );

        this.Name = options.name;
        this.Input = options.input;
        this.InstanceId = options.instanceId;
    }
}
