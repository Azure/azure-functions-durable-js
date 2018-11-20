import { OrchestrationRuntimeStatus } from "./classes";

export class DurableOrchestrationStatus {
    constructor(
        public name: string,
        public instanceId: string,
        public createdTime: Date,
        public lastUpdatedTime: Date,
        public input: unknown,
        public output: unknown,
        public runtimeStatus: OrchestrationRuntimeStatus,
        public customStatus?: unknown,
        public history?: Array<unknown>,
    ) { }
}
