import { HistoryEvent } from "./historyevent";
import { HistoryEventOptions } from "./historyeventoptions";
import { HistoryEventType } from "./historyeventtype";

/** @hidden */
export class OrchestratorCompletedEvent extends HistoryEvent {
    constructor(options: HistoryEventOptions) {
        super(
            HistoryEventType.OrchestratorCompleted,
            options.eventId,
            options.isPlayed,
            options.timestamp
        );
    }
}
