import { OrchestrationRuntimeStatus } from "./types";
import * as types from "./types";

export class DurableOrchestrationStatus implements types.DurableOrchestrationStatus {
    /** @hidden */
    constructor(
        public readonly name: string,
        public readonly instanceId: string,
        public readonly createdTime: Date,
        public readonly lastUpdatedTime: Date,
        public readonly input: unknown,
        public readonly output: unknown,
        public readonly runtimeStatus: OrchestrationRuntimeStatus,
        public readonly customStatus?: unknown,
        public readonly history?: Array<unknown>
    ) {}
}
