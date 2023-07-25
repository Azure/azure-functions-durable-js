import { HistoryEvent } from "../history/HistoryEvent";
import { ReplaySchema } from "./ReplaySchema";

/** @hidden */
export class DurableOrchestrationBindingInfoReqFields {
    constructor(
        public readonly history: HistoryEvent[] = [],
        public readonly instanceId: string = "",
        public readonly isReplaying: boolean = false,
        public readonly upperSchemaVersion: ReplaySchema = ReplaySchema.V1 // TODO: Implement entity locking // public readonly contextLocks?: EntityId[],
    ) {}
}

/** @hidden */
export class DurableOrchestrationBindingInfo extends DurableOrchestrationBindingInfoReqFields {
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
    ) {
        super(history, instanceId, isReplaying, upperSchemaVersion);
    }
}
