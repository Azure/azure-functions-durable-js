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
import { omitDurableGrpcOptions } from "./durableGrpc";
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
    const functionOptions = omitDurableGrpcOptions(options);

    azFuncApp.generic(functionName, {
        trigger: trigger.orchestration(options),
        ...functionOptions,
        handler: createOrchestrator(functionOptions.handler),
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
    const functionOptions = omitDurableGrpcOptions(options);

    azFuncApp.generic(functionName, {
        trigger: trigger.entity(options),
        ...functionOptions,
        handler: createEntityFunction(functionOptions.handler),
    });
}

export function activity(functionName: string, options: ActivityOptions): RegisteredActivity {
    const functionOptions = omitDurableGrpcOptions(options);

    azFuncApp.generic(functionName, {
        trigger: trigger.activity(options),
        ...functionOptions,
    });

    const result: RegisteredActivity = (input?: unknown): RegisteredActivityTask => {
        return new RegisteredActivityTask(functionName, input);
    };

    return result;
}

export * as client from "./client";
