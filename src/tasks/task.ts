import { IAction } from "../classes";
import { Task } from "./taskinterfaces";

/**
 * Represents some pending action. Similar to a native JavaScript promise in
 * that it acts as a placeholder for outstanding asynchronous work, but has
 * a synchronous implementation and is specific to Durable Functions.
 *
 * Tasks are only returned to an orchestration function when a
 * [[DurableOrchestrationContext]] operation is not called with `yield`. They
 * are useful for parallelization and timeout operations in conjunction with
 * Task.all and Task.any.
 *
 * We discourage the usage of `instanceof`-style guards on this type,
 * as it is subject to change in the future.
 *
 * @example Wait for all parallel operations to complete
 * ```javascript
 * const operations = context.df.callActivity("GetOperations");
 *
 * const tasks = [];
 * for (const operation of operations) {
 *     tasks.push(context.df.callActivity("DoOperation", operation));
 * }
 *
 * const results = yield context.df.Task.all(tasks);
 * ```
 *
 * @example Return the result of the first of two operations to complete
 * ```javascript
 * const taskA = context.df.callActivity("DoWorkA");
 * const taskB = context.df.callActivity("DoWorkB");
 *
 * const firstDone = yield context.df.Task.any([taskA, taskB]);
 *
 * return firstDone.result;
 * ```
 */
export class SingleTask implements Task {
    /**
     * @hidden
     * Used to keep track of how many times the task has been yielded to avoid
     * scheduling the internal action multiple times _Internal use only._
     */
    private wasYielded = false;

    /** @hidden */
    constructor(
        /**
         * Whether the task has completed. Note that completion is not
         * equivalent to success.
         */
        public readonly isCompleted: boolean,
        /**
         * Whether the task faulted in some way due to error.
         */
        public readonly isFaulted: boolean,
        /**
         * @hidden
         * The scheduled action represented by the task. _Internal use only._
         */
        public readonly action: IAction,
        /**
         * The result of the task, if completed. Otherwise `undefined`.
         */
        public readonly result?: unknown,
        /**
         * @hidden
         * The timestamp of the task.
         */
        public readonly timestamp?: Date,
        /**
         * @hidden
         * The ID number of the task. _Internal use only._
         */
        public readonly id?: number,
        /**
         * The error thrown when attempting to perform the task's action. If
         * the Task has not yet completed or has completed successfully,
         * `undefined`.
         */
        public readonly exception?: Error | undefined,

        /**
         * @hidden
         * The index in the history state where the task was marked completed. _Internal use only._
         */
        public readonly completionIndex?: number,
    ) { }

    /**
     * @hidden
     * _Internal use only._
     */
    public yieldNewActions(): IAction[] {
        if (!this.wasYielded) {
            this.wasYielded = true;
            return [ this.action ];
        }

        return [];
    }
}
