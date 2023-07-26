import { TaskOrchestrationExecutor } from "./TaskOrchestrationExecutor";

class ExecutorManager {
    #_executor?: TaskOrchestrationExecutor;
    #notDefinedMsg =
        "task orchestration executor is not defined. " +
        "Attempting to access the executor outside of an orchestration context is not allowed.";

    get taskOrchestrationExecutor(): TaskOrchestrationExecutor {
        if (!this.#_executor) {
            throw new Error(this.#notDefinedMsg);
        } else {
            return this.#_executor;
        }
    }

    set taskOrchestrationExecutor(executor: TaskOrchestrationExecutor | undefined) {
        this.#_executor = executor;
    }
}

export const executorManager = new ExecutorManager();
