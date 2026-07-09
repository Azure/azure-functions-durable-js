/**
 * Structured details about a failed activity, orchestration, or entity
 * operation. Mirrors `DurableTask.Core.FailureDetails`.
 */
export interface FailureDetails {
    /** The error type, typically `Error.name` or the language-specific exception type. */
    errorType: string;
    /** The error message. */
    errorMessage: string;
    /** Stack trace, when available. */
    stackTrace?: string;
    /** Whether the failure was flagged non-retriable by the worker. */
    isNonRetriable: boolean;
    /**
     * Custom key/value properties attached by the failing worker via its
     * `ExceptionPropertiesProvider`. Undefined when the worker attached no
     * properties or when the host did not propagate them.
     */
    properties?: Record<string, unknown>;
    /** Inner failure cause, if any. */
    innerFailure?: FailureDetails;
    /**
     * Returns true if this failure, or any failure in its `innerFailure`
     * chain, has the given `errorType`. Mirrors .NET's
     * `FailureDetails.IsCausedBy<T>()`.
     *
     * @param errorType The error type to look for (matched against `errorType`).
     */
    isCausedBy(errorType: string): boolean;
}

/**
 * Error thrown into orchestrator generators when a scheduled activity or
 * sub-orchestration fails and the host extension provided structured
 * `FailureDetails`. Use `instanceof TaskFailedError` inside a `try/catch`
 * around a `yield context.df.callActivity(...)` to read `.failureDetails`.
 *
 * @example
 * ```typescript
 * import * as df from "durable-functions";
 *
 * df.app.orchestration("orch", function* (context) {
 *     try {
 *         yield context.df.callActivity("doWork", input);
 *     } catch (err) {
 *         if (err instanceof df.TaskFailedError) {
 *             const code = err.failureDetails.properties?.errorCode;
 *             // ... branch on structured properties
 *         }
 *         throw err;
 *     }
 * });
 * ```
 */
export declare class TaskFailedError extends Error {
    constructor(failureDetails: FailureDetails);
    readonly failureDetails: FailureDetails;
    /** The name of the failed activity or sub-orchestration, when available. */
    readonly taskName?: string;
    /** The scheduled task ID of the failed task, when available. */
    readonly taskId?: number;
}
