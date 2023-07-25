import { HistoryEvent } from "./HistoryEvent";
import { HistoryEventOptions } from "./HistoryEventOptions";
import { HistoryEventType } from "./HistoryEventType";

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
