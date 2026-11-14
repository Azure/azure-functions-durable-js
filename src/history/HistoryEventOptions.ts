import { FailureDetailsPayload } from "./FailureDetailsPayload";
import { RetryMetadataPayload } from "./RetryMetadataPayload";

/** @hidden */
export class HistoryEventOptions {
    public details?: string;
    public failureDetails?: FailureDetailsPayload;
    public fireAt?: Date;
    public input?: string;
    public instanceId?: string;
    public name?: string;
    public reason?: string;
    public result?: string;
    public retryMetadata?: RetryMetadataPayload;
    public taskScheduledId?: number;
    public timerId?: number;
    public version?: string;

    constructor(public eventId: number, public timestamp: Date, public isPlayed: boolean = false) {}
}
