import {
    ActivityOptions,
    EntityHandler,
    EntityOptions,
    OrchestrationHandler,
    OrchestrationOptions,
    RegisteredActivity,
    RegisteredOrchestration,
} from "durable-functions";
import * as trigger from "./trigger";
import { createOrchestrator, createEntityFunction } from "./util/testingUtils";
import { app as azFuncApp } from "@azure/functions";
import { RegisteredOrchestrationTask } from "./task/RegisteredOrchestrationTask";
import { RegisteredActivityTask } from "./task/RegisteredActivityTask";

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

    const result: RegisteredOrchestration = (
        input?: unknown,
        instanceId?: string
    ): RegisteredOrchestrationTask => {
        return new RegisteredOrchestrationTask(functionName, input, instanceId);
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

export function activity(functionName: string, options: ActivityOptions): RegisteredActivity {
    azFuncApp.generic(functionName, {
        trigger: trigger.activity(),
        ...options,
    });

    const result: RegisteredActivity = (input?: unknown): RegisteredActivityTask => {
        return new RegisteredActivityTask(functionName, input);
    };

    return result;
}

export * as client from "./client";
