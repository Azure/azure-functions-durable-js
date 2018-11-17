import { HistoryEvent, HistoryEventOptions, HistoryEventType } from "../classes";

export class SubOrchestrationInstanceCreatedEvent extends HistoryEvent {
    public Name: string;
    public InstanceId: string;
    public Input: string;

    constructor(
        options: HistoryEventOptions,
    ) {
        super(
            HistoryEventType.SubOrchestrationInstanceCreated,
            options.eventId,
            options.isPlayed,
            options.timestamp,
        );

        this.Name = options.name;
        this.InstanceId = options.instanceId;
        this.Input = options.input;
    }
}