import { HistoryEvent } from "./historyevent";
import { HistoryEventOptions } from "./historyeventoptions";
import { HistoryEventType } from "./historyeventtype";

/** @hidden */
export class OrchestratorStartedEvent extends HistoryEvent {
    constructor(options: HistoryEventOptions) {
        super(
            HistoryEventType.OrchestratorStarted,
            options.eventId,
            options.isPlayed,
            options.timestamp
        );
    }
}
