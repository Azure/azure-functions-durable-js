import { HistoryEvent } from "./classes";
import { LatestReplaySchema, ReplaySchema } from "./replaySchema";

/** @hidden */
export class DurableOrchestrationBindingInfo {
    public readonly upperSchemaVersion: ReplaySchema;

    constructor(
        public readonly history: HistoryEvent[] = [],
        public readonly input?: unknown,
        public readonly instanceId: string = "",
        public readonly isReplaying: boolean = false,
        public readonly parentInstanceId?: string,
        public readonly maximumShortTimerDuration?: string,
        public readonly longRunningTimerIntervalDuration?: string,
        public readonly defaultHttpAsyncRequestSleepTimeMillseconds?: number,
        upperSchemaVersion = 0 // TODO: Implement entity locking // public readonly contextLocks?: EntityId[],
    ) {
        // It is assumed that the extension supports all schemas in range [0, upperSchemaVersion].
        // Similarly, it is assumed that this SDK supports all schemas in range [0, LatestReplaySchema].

        // Therefore, if the extension supplies a upperSchemaVersion included in our ReplaySchema enum, we use it.
        // But if the extension supplies an upperSchemaVersion not included in our ReplaySchema enum, then we
        // assume that upperSchemaVersion is larger than LatestReplaySchema and therefore use LatestReplaySchema instead.
        if (Object.values(ReplaySchema).includes(upperSchemaVersion)) {
            this.upperSchemaVersion = upperSchemaVersion;
        } else {
            this.upperSchemaVersion = LatestReplaySchema;
        }
    }
}
