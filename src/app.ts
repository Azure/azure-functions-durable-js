import {
    ActivityOptions,
    EntityHandler,
    EntityOptions,
    OrchestrationHandler,
    OrchestrationOptions,
} from "durable-functions";
import * as trigger from "./trigger";
import { createOrchestrator, createEntityFunction } from "./testingUtils";
import { app as azFuncApp } from "@azure/functions";

export function orchestration(
    functionName: string,
    handlerOrOptions: OrchestrationHandler | OrchestrationOptions
): void {
    const options: OrchestrationOptions =
        typeof handlerOrOptions === "function" ? { handler: handlerOrOptions } : handlerOrOptions;

    azFuncApp.generic(functionName, {
        trigger: trigger.orchestration(),
        ...options,
        handler: createOrchestrator(options.handler),
    });
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

export function activity(functionName: string, options: ActivityOptions): void {
    azFuncApp.generic(functionName, {
        trigger: trigger.activity(),
        ...options,
    });
}
