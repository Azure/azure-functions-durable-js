import { HistoryEvent } from "./classes";
import { UpperSchemaVersion } from "./upperSchemaVersion";

/** @hidden */
export class DurableOrchestrationBindingInfo {
    public readonly upperSchemaVersion: UpperSchemaVersion;

    constructor(
        public readonly history: HistoryEvent[] = [],
        public readonly input?: unknown,
        public readonly instanceId: string = "",
        public readonly isReplaying: boolean = false,
        public readonly parentInstanceId?: string,
        upperSchemaVersion = 0 // TODO: Implement entity locking // public readonly contextLocks?: EntityId[],
    ) {
        if (Object.values(UpperSchemaVersion).includes(upperSchemaVersion)) {
            this.upperSchemaVersion = upperSchemaVersion;
        } else {
            this.upperSchemaVersion = UpperSchemaVersion.V1;
        }
    }
}
