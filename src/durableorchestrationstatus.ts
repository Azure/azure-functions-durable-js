import { OrchestrationRuntimeStatus } from "./classes";

export class DurableOrchestrationStatus {
    constructor(
        public name: string,
        public instanceId: string,
        public createdTime: Date,
        public lastUpdatedTime: Date,
        public input: any,
        public output: any,
        public runtimeStatus: OrchestrationRuntimeStatus,
        public customStatus?: any,
        public history?: any[],
    ) { }
}
