import * as types from "./types";

export class DurableOrchestrationStatus implements types.DurableOrchestrationStatus {
    constructor(
        /** The orchestrator function name. */
        public readonly name: string,
        /**
         * The unique ID of the instance.
         *
         * The instance ID is generated and fixed when the orchestrator
         * function is scheduled. It can either auto-generated, in which case
         * it is formatted as a GUID, or it can be user-specified with any
         * format.
         */
        public readonly instanceId: string,
        /**
         * The time at which the orchestration instance was created.
         *
         * If the orchestration instance is in the [[Pending]] status, this
         * time represents the time at which the orchestration instance was
         * scheduled.
         */
        public readonly createdTime: Date,
        /**
         * The time at which the orchestration instance last updated its
         * execution history.
         */
        public readonly lastUpdatedTime: Date,
        /**
         * The input of the orchestration instance.
         */
        public readonly input: unknown,
        /**
         * The output of the orchestration instance.
         */
        public readonly output: unknown,
        /**
         * The runtime status of the orchestration instance.
         */
        public readonly runtimeStatus: types.OrchestrationRuntimeStatus,
        /**
         * The custom status payload (if any) that was set by
         * [[DurableOrchestrationClient]].[[setCustomStatus]].
         */
        public readonly customStatus?: unknown,
        /**
         * The execution history of the orchestration instance.
         *
         * The history log can be large and is therefore `undefined` by
         * default. It is populated only when explicitly requested in the call
         * to [[DurableOrchestrationClient]].[[getStatus]].
         */
        public readonly history?: Array<unknown>
    ) {}
}
