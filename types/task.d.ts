/**
 * A Durable Functions Task.
 */
export interface Task {
    /**
     * Whether the task has completed. Note that completion is not
     * equivalent to success.
     */
    isCompleted: boolean;
    /**
     * Whether the task faulted in some way due to error.
     */
    isFaulted: boolean;
    /**
     * The result of the task, if completed. Otherwise `undefined`.
     */
    result?: unknown;
}

/**
 * Returned from [[DurableClient]].[[createTimer]] if the call is
 * not `yield`-ed. Represents a pending timer. See documentation on [[Task]]
 * for more information.
 *
 * All pending timers must be completed or canceled for an orchestration to
 * complete.
 *
 * @example Cancel a timer
 * ```javascript
 * // calculate expiration date
 * const timeoutTask = context.df.createTimer(expirationDate);
 *
 * // do some work
 *
 * if (!timeoutTask.isCompleted) {
 *     // An orchestration won't get marked as completed until all its scheduled
 *     // tasks have returned, or been cancelled. Therefore, it is important
 *     // to cancel timers when they're no longer needed
 *     timeoutTask.cancel();
 * }
 * ```
 *
 * @example Create a timeout
 * ```javascript
 * const now = Date.now();
 * const expiration = new Date(now.valueOf()).setMinutes(now.getMinutes() + 30);
 *
 * const timeoutTask = context.df.createTimer(expirationDate);
 * const otherTask = context.df.callActivity("DoWork");
 *
 * const winner = yield context.df.Task.any([timeoutTask, otherTask]);
 *
 * if (winner === otherTask) {
 *     // do some more work
 * }
 *
 * if (!timeoutTask.isCompleted) {
 *     // An orchestration won't get marked as completed until all its scheduled
 *     // tasks have returned, or been cancelled. Therefore, it is important
 *     // to cancel timers when they're no longer needed
 *     timeoutTask.cancel();
 * }
 * ```
 */
export interface TimerTask extends Task {
    /**
     * @returns Whether or not the timer has been canceled.
     */
    isCanceled: boolean;
    /**
     * Indicates the timer should be canceled. This request will execute on the
     * next `yield` or `return` statement.
     */
    cancel: () => void;
}

/**
 * A specific error thrown when context.df.Task.all() fails. Its message
 * contains an aggregation of all the exceptions that failed. It should follow the
 * below format:
 *
 * context.df.Task.all() encountered the below error messages:
 *
 * Name: DurableError
 * Message: The activity function "ActivityA" failed.
 * StackTrace: <stacktrace>
 * -----------------------------------
 * Name: DurableError
 * Message: The activity function "ActivityB" failed.
 * StackTrace: <stacktrace>
 */
export declare class AggregatedError extends Error {
    /**
     * The list of errors nested inside this `AggregatedError`
     */
    errors: Error[];

    /**
     * Construct an `AggregatedError` using a list of errors
     * @param errors List of errors.
     */
    constructor(errors: Error[]);
}
