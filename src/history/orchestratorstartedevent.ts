import { HistoryEvent, HistoryEventOptions, HistoryEventType } from "../classes";

/** @hidden */
export class OrchestratorStartedEvent extends HistoryEvent {
    constructor(
        options: HistoryEventOptions,
    ) {
        super(
            HistoryEventType.OrchestratorStarted,
            options.eventId,
            options.isPlayed,
            options.timestamp,
        );
    }
}
