import { HistoryEvent } from "./HistoryEvent";
import { HistoryEventOptions } from "./HistoryEventOptions";
import { HistoryEventType } from "./HistoryEventType";
import { RetryMetadataPayload } from "./RetryMetadataPayload";

/** @hidden */
export class TaskScheduledEvent extends HistoryEvent {
    public Name: string;
    public Input: string | undefined;
    public RetryMetadata?: RetryMetadataPayload;

    constructor(options: HistoryEventOptions) {
        super(HistoryEventType.TaskScheduled, options.eventId, options.isPlayed, options.timestamp);

        if (options.name === undefined) {
            throw new Error("TaskScheduledEvent needs a name provided.");
        }

        this.Input = options.input;
        this.Name = options.name;
        if (options.retryMetadata !== undefined) {
            this.RetryMetadata = options.retryMetadata;
        }
    }
}
