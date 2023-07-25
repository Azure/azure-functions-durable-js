import { HistoryEvent } from "./HistoryEvent";
import { HistoryEventOptions } from "./HistoryEventOptions";
import { HistoryEventType } from "./HistoryEventType";

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
