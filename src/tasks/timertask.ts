import { CreateTimerAction } from "../classes";
import { Task } from "./task";

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
    constructor(
        isCompleted: boolean,
        /**
         * @hidden
         * The scheduled action represented by the task. _Internal use only._
         */
        public readonly action: CreateTimerAction,
        timestamp?: Date,
        id?: number,
        completionIndex?: number,
    ) {
        super(isCompleted, false, action, undefined, timestamp, id, undefined, completionIndex);
    }

    /**
     * @returns Whether or not the timer has been canceled.
     */
    get isCanceled(): boolean {
        return this.action.isCanceled;
    }

    /**
     * Indicates the timer should be canceled. This request will execute on the
     * next `yield` or `return` statement.
     */
    public cancel() {
        if (!this.isCompleted) {
            this.action.isCanceled = true;
        } else {
            throw new Error("Cannot cancel a completed task.");
        }
    }
}
