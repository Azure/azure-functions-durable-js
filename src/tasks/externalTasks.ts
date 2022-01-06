import { InnerTimerTask, ProperTask, TaskState } from "./internalTasks";

export class Task {
    /**
     * Whether the task has completed. Note that completion is not
     * equivalent to success.
     */
    get isCompleted(): boolean {
        return this.innerTask.state === TaskState.Completed;
    }
    /**
     * Whether the task faulted in some way due to error.
     */
    get isFaulted(): boolean {
        return this.innerTask.state === TaskState.Failed;
    }

    /**
     * The result of the task, if completed. Otherwise `undefined`.
     */
    get result(): unknown | undefined {
        return this.isCompleted ? this.innerTask.result : undefined;
    }

    /**
     * The error thrown when attempting to perform the task's action. If
     * the Task has not yet completed or has completed successfully,
     * `undefined`.
     */
    get exception(): Error | undefined {
        return this.isFaulted ? (this.innerTask.result as Error) : undefined;
    }

    /** @internal */
    get internalTask(): ProperTask {
        this.innerTask.externalTask = this;
        return this.innerTask;
    }

    /** @hidden */
    constructor(protected readonly innerTask: ProperTask) {}
}

/**
 * Returned from [[DurableOrchestrationClient]].[[createTimer]] if the call is
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
 *     timeoutTask.cancel();
 * }
 * ```
 */
export class TimerTask extends Task {
    /** @hidden */
    constructor(protected readonly innerTask: InnerTimerTask) {
        super(innerTask);
    }

    /**
     * @returns Whether or not the timer has been canceled.
     */
    get isCancelled(): boolean {
        return this.innerTask.isCancelled;
    }

    /**
     * Indicates the timer should be canceled. This request will execute on the
     * next `yield` or `return` statement.
     */
    public cancel(): void {
        return this.innerTask.cancel();
    }
}
