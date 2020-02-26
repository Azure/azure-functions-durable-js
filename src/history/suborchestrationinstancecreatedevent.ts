import { HistoryEvent, HistoryEventOptions, HistoryEventType } from "../classes";

/** @hidden */
export class SubOrchestrationInstanceCreatedEvent extends HistoryEvent {
    public Name: string;
    public InstanceId: string;
    public Input: string | undefined;

    constructor(options: HistoryEventOptions) {
        super(HistoryEventType.SubOrchestrationInstanceCreated, options.eventId, options.isPlayed, options.timestamp);

        if (options.name === undefined) {
            throw new Error("SubOrchestrationInstanceCreatedEvent needs a name provided.");
        }

        if (options.instanceId === undefined) {
            throw new Error("SubOrchestrationInstanceCreatedEvent needs an instance id provided.");
        }

        this.Input = options.input;
        this.Name = options.name;
        this.InstanceId = options.instanceId;
    }
}
