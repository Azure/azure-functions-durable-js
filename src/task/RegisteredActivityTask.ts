import * as types from "durable-functions";
import { AtomicTask } from "./AtomicTask";
import { RetryOptions } from "../RetryOptions";
import { CallActivityAction } from "../actions/CallActivityAction";
import { CallActivityWithRetryAction } from "../actions/CallActivityWithRetryAction";
import { RetryableTask } from "./RetryableTask";

export class RegisteredActivityTask extends AtomicTask implements types.RegisteredActivityTask {
    withRetry: (retryOptions: RetryOptions) => RetryableTask;

    constructor(activityName: string, input?: unknown) {
        super(false, new CallActivityAction(activityName, input));

        this.withRetry = (retryOptions: RetryOptions): RetryableTask => {
            if (this.alreadyScheduled) {
                throw new Error(
                    "Invalid use of `.withRetry`: attempted to create a retry task from an already scheduled task. " +
                        `A task with ID ${this.id} to call activity ${activityName} has already been scheduled. ` +
                        "Make sure you only call `.withRetry` on tasks that have not previously been yielded."
                );
            }

            const callActivityWithRetryAction = new CallActivityWithRetryAction(
                activityName,
                retryOptions,
                input
            );
            const backingTask = new AtomicTask(false, callActivityWithRetryAction);
            return new RetryableTask(backingTask, retryOptions);
        };
    }
}
