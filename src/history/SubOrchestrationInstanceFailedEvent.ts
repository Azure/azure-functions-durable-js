import { FailureDetailsPayload } from "./FailureDetailsPayload";
import { HistoryEvent } from "./HistoryEvent";
import { HistoryEventOptions } from "./HistoryEventOptions";
import { HistoryEventType } from "./HistoryEventType";

/** @hidden */
export class SubOrchestrationInstanceFailedEvent extends HistoryEvent {
    public TaskScheduledId: number;
    public Reason: string | undefined;
    public Details: string | undefined;
    public FailureDetails: FailureDetailsPayload | undefined;

    constructor(options: HistoryEventOptions) {
        super(
            HistoryEventType.SubOrchestrationInstanceFailed,
            options.eventId,
            options.isPlayed,
            options.timestamp
        );

        if (options.taskScheduledId === undefined) {
            throw new Error(
                "SubOrchestrationInstanceFailedEvent needs a task scheduled id provided."
            );
        }

        this.TaskScheduledId = options.taskScheduledId;
        this.Reason = options.reason;
        this.Details = options.details;
        this.FailureDetails = options.failureDetails;
    }
}
