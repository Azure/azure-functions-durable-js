import { HistoryEvent } from "./classes";
import { LatestReplaySchema, ReplaySchema } from "./replaySchema";

/** @hidden */
export class DurableOrchestrationBindingInfo {
    public readonly upperSchemaVersionNew?: ReplaySchema;

    constructor(
        public readonly history: HistoryEvent[] = [],
        public readonly input?: unknown,
        public readonly instanceId: string = "",
        public readonly isReplaying: boolean = false,
        public readonly parentInstanceId?: string,
        public readonly maximumShortTimerDuration?: string,
        public readonly longRunningTimerIntervalDuration?: string,
        public readonly defaultHttpAsyncRequestSleepTimeMillseconds?: number,
        public readonly upperSchemaVersion: ReplaySchema = ReplaySchema.V1 // TODO: Implement entity locking // public readonly contextLocks?: EntityId[],
    ) {}
}
