import { HistoryEvent } from "./classes";

/** @hidden */
export class DurableOrchestrationBindingInfo {
    constructor(
        public readonly history: HistoryEvent[] = [],
        public readonly input?: unknown,
        public readonly instanceId?: string,
        public readonly isReplaying?: boolean,
        public readonly parentInstanceId?: string,
    ) { }
}
