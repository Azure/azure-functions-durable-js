import { HistoryEvent, HistoryEventOptions, HistoryEventType } from "../classes";

export class OrchestratorCompletedEvent extends HistoryEvent {
    constructor(
        options: HistoryEventOptions,
    ) {
        super(
            HistoryEventType.OrchestratorCompleted,
            options.eventId,
            options.isPlayed,
            options.timestamp,
        );
    }
}