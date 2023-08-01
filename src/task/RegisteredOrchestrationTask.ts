import * as types from "durable-functions";
import { CallSubOrchestratorAction } from "../actions/CallSubOrchestratorAction";
import { CallSubOrchestratorWithRetryAction } from "../actions/CallSubOrchestratorWithRetryAction";
import { AtomicTask } from "./AtomicTask";
import { RetryableTask } from "./RetryableTask";
import { RetryOptions } from "../RetryOptions";

export class RegisteredOrchestrationTask extends AtomicTask
    implements types.RegisteredOrchestrationTask {
    withRetry: (retryOptions: RetryOptions) => RetryableTask;

    constructor(orchestrationName: string, input?: unknown, instanceId?: string) {
        super(false, new CallSubOrchestratorAction(orchestrationName, instanceId, input));

        this.withRetry = (retryOptions: RetryOptions): RetryableTask => {
            if (this.alreadyScheduled) {
                throw new Error(
                    "Invalid use of `.withRetry`: attempted to create a retry task from an already scheduled task. " +
                        `A task with ID ${this.id} to call subOrchestrator ${orchestrationName} has already been scheduled. ` +
                        "Make sure you only call `.withRetry` on tasks that have not previously been yielded."
                );
            }

            const callSubOrchestratorWithRetryAction = new CallSubOrchestratorWithRetryAction(
                orchestrationName,
                retryOptions,
                input,
                instanceId
            );
            const backingTask = new AtomicTask(false, callSubOrchestratorWithRetryAction);
            return new RetryableTask(backingTask, retryOptions);
        };
    }
}
