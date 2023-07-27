import { RetryOptions } from "durable-functions";
import { TaskOrchestrationExecutor } from "../orchestrations/TaskOrchestrationExecutor";
import { TaskState } from ".";
import { DFTask } from "./DFTask";
import { NoOpTask } from "./NoOpTask";
import { TaskBase } from "./TaskBase";
import { WhenAllTask } from "./WhenAllTask";

/**
 * @hidden
 *
 * A `-WithRetry` Task.
 * It is modeled after a `WhenAllTask` because it decomposes
 * into several sub-tasks (a growing sequence of timers and atomic tasks)
 * that all need to complete before this task reaches an end-value.
 */
export class RetryableTask extends WhenAllTask {
    private isWaitingOnTimer: boolean;
    private attemptNumber: number;
    private error: any;

    /**
     * @hidden
     * Construct a retriable task.
     *
     * @param innerTask
     *  The task representing the work to retry
     * @param retryOptions
     *  The retrying settings
     * @param executor
     *  The taskOrchestrationExecutor managing the replay,
     *  we use to to scheduling new tasks (timers and retries)
     */
    constructor(public innerTask: DFTask, private retryOptions: RetryOptions) {
        super([innerTask], innerTask.actionObj);
        this.attemptNumber = 1;
        this.isWaitingOnTimer = false;
    }

    /**
     * @hidden
     * Attempts to set a value to this task, given a completed sub-task
     *
     * @param child
     *  The sub-task that just completed
     */
    public trySetValue(child: TaskBase, executor?: TaskOrchestrationExecutor): void {
        if (!executor) {
            throw new Error(
                "Ne executor passed to RetryableTask.trySetValue. " +
                    "A TaskOrchestrationExecutor is required to schedule new tasks."
            );
        }

        // Case 1 - child is a timer task
        if (this.isWaitingOnTimer) {
            this.isWaitingOnTimer = false;

            // If we're out of retry attempts, we can set the output value
            // of this task to be that of the last error we encountered
            if (this.attemptNumber > this.retryOptions.maxNumberOfAttempts) {
                this.setValue(true, this.error);
            } else {
                // If we still have more attempts available, we re-schedule the
                // original task. Since these sub-tasks are not user-managed,
                // they are declared as internal tasks.
                const rescheduledTask = new NoOpTask();
                rescheduledTask.parent = this;
                this.children.push(rescheduledTask);
                executor.trackOpenTask(rescheduledTask);
            }
        } // Case 2 - child is the API to retry, and it succeeded
        else if (child.stateObj === TaskState.Completed) {
            // If we have a successful non-timer task, we accept its result
            this.setValue(false, child.result);
        } // Case 3 - child is the API to retry, and it failed
        else {
            // If the sub-task failed, schedule timer to retry again.
            // Since these sub-tasks are not user-managed, they are declared as internal tasks.
            const rescheduledTask = new NoOpTask();
            rescheduledTask.parent = this;
            this.children.push(rescheduledTask);
            executor.trackOpenTask(rescheduledTask);
            this.isWaitingOnTimer = true;
            this.error = child.result;
            this.attemptNumber++;
        }
    }
}
