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
