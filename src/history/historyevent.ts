import { HistoryEventType } from "../classes";

export abstract class HistoryEvent {
    constructor(
        public EventType: HistoryEventType,
        public EventId: number,
        public IsPlayed: boolean,
        public Timestamp: Date,
        public IsProcessed: boolean = false,
    ) { }
}
