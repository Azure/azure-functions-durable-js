import {
    ActivityOptions,
    EntityHandler,
    EntityOptions,
    OrchestrationHandler,
    OrchestrationOptions,
    RegisteredActivity,
    RegisteredOrchestration,
} from "durable-functions";
import { app as azFuncApp } from "@azure/functions";
import { createEntityFunction, createOrchestrator, trigger } from "./shim";
import { RegisteredActivityTask, RegisteredOrchestrationTask } from "./task";
import { TaskOrchestrationExecutor } from "./taskorchestrationexecutor";

class ExecutorContext {
    #_executor?: TaskOrchestrationExecutor;
    #notInitializedMsg =
        "taskOrchestrationExecutor is not initialized." +
        " Attempting to access the executor outside of an orchestration context is not allowed.";

    get taskOrchestrationExecutor(): TaskOrchestrationExecutor {
        if (!this.#_executor) {
            throw new Error(this.#notInitializedMsg);
        } else {
            return this.#_executor;
        }
    }
    set taskOrchestrationExecutor(executor: TaskOrchestrationExecutor) {
        this.#_executor = executor;
    }
}

export const executorContext = new ExecutorContext();

export function orchestration(
    functionName: string,
    handlerOrOptions: OrchestrationHandler | OrchestrationOptions
): RegisteredOrchestration {
    const options: OrchestrationOptions =
        typeof handlerOrOptions === "function" ? { handler: handlerOrOptions } : handlerOrOptions;

    azFuncApp.generic(functionName, {
        trigger: trigger.orchestration(),
        ...options,
        handler: createOrchestrator(options.handler),
    });

    const result: RegisteredOrchestration = (input?: unknown, instanceId?: string) => {
        return new RegisteredOrchestrationTask(
            functionName,
            this.taskOrchestrationExecutor,
            input,
            instanceId
        );
    };

    return result;
}

export function entity<T = unknown>(
    functionName: string,
    handlerOrOptions: EntityHandler<T> | EntityOptions<T>
): void {
    const options: EntityOptions<T> =
        typeof handlerOrOptions === "function" ? { handler: handlerOrOptions } : handlerOrOptions;

    azFuncApp.generic(functionName, {
        trigger: trigger.entity(),
        ...options,
        handler: createEntityFunction(options.handler),
    });
}

export const activity = (functionName: string, options: ActivityOptions): RegisteredActivity => {
    azFuncApp.generic(functionName, {
        trigger: trigger.activity(),
        ...options,
    });

    const result: RegisteredActivity = (input?: unknown) => {
        return new RegisteredActivityTask(functionName, input);
    };

    return result;
};
