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
                    "This subOrchestrator has already been scheduled. You cannot call withRetry on an already scheduled task. Create a new task instead."
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
