import { HistoryEvent } from "./classes";
import { UpperSchemaVersion } from "./replaySchema";

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
        // If the extension-sent upperSchemaVersion is within the range of values
        // we support, we select it. Otherwise, we conclude it's higher than any
        // version we support, so we default to our highest version.
        if (Object.values(UpperSchemaVersion).includes(upperSchemaVersion)) {
            this.upperSchemaVersion = upperSchemaVersion;
        } else {
            this.upperSchemaVersion = UpperSchemaVersion.V2;
        }
    }
}
