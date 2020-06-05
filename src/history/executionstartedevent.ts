import { HistoryEvent, HistoryEventOptions, HistoryEventType } from "../classes";

/** @hidden */
export class ExecutionStartedEvent extends HistoryEvent {
    public Name: string;
    public Input: string | undefined;

    constructor(options: HistoryEventOptions) {
        super(
            HistoryEventType.ExecutionStarted,
            options.eventId,
            options.isPlayed,
            options.timestamp
        );

        if (options.name === undefined) {
            throw new Error("ExecutionStartedEvent needs a name provided.");
        } else {
            this.Name = options.name;
        }

        this.Input = options.input;
    }
}
