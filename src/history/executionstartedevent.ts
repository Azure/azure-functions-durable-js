import { HistoryEvent, HistoryEventOptions, HistoryEventType } from "../classes";

export class ExecutionStartedEvent extends HistoryEvent {
    public Name: string;
    public Input: string;
    
    constructor(
        options: HistoryEventOptions,
    ) {
        super(
            HistoryEventType.ExecutionStarted,
            options.eventId,
            options.isPlayed,
            options.timestamp,
        );

        this.Name = options.name;
        this.Input = options.input;
    }
}