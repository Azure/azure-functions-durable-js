/**
 * The status of an orchestration instance.
 */
export enum OrchestrationRuntimeStatus {
    /**
     * The orchestration instance has started running.
     */
    Running = "Running",

    /**
     * The orchestration instance has completed normally.
     */
    Completed = "Completed",

    /**
     * The orchestration instance has restarted itself with a new history.
     * This is a transient state.
     */
    ContinuedAsNew = "ContinuedAsNew",

    /**
     * The orchestration instance failed with an error.
     */
    Failed = "Failed",

    /**
     * The orchestration was canceled gracefully.
     */
    Canceled = "Canceled",

    /**
     * The orchestration instance was stopped abruptly.
     */
    Terminated = "Terminated",

    /**
     * The orchestration instance has been scheduled but has not yet started
     * running.
     */
    Pending = "Pending",
}
