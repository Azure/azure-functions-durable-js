import {
    ActivityHandler,
    ActivityOptions,
    EntityHandler,
    EntityOptions,
    ExceptionPropertiesProvider,
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
import {
    buildTaskFailureDetailsJson,
    setRegisteredExceptionPropertiesProvider,
} from "./error/ExceptionPropertiesProvider";

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
        handler: wrapActivityHandler(options.handler),
    });

    const result: RegisteredActivity = (input?: unknown): RegisteredActivityTask => {
        return new RegisteredActivityTask(functionName, input);
    };

    return result;
}

export function setExceptionPropertiesProvider(
    provider: ExceptionPropertiesProvider | undefined
): void {
    setRegisteredExceptionPropertiesProvider(provider);
}

/**
 * Wraps a user-supplied activity handler so that thrown errors are reshaped
 * into a TaskFailureDetails JSON payload (with custom properties from the
 * registered {@link ExceptionPropertiesProvider}) before propagating to the
 * Functions host. The host extension's OutOfProcMiddleware parses this payload
 * and surfaces the structured properties on `FailureDetails.Properties`.
 *
 * If no provider is registered or it returns no properties, the error is
 * re-thrown untouched so the legacy `ExceptionType: Message` wire format is
 * preserved.
 */
function wrapActivityHandler(handler: ActivityHandler): ActivityHandler {
    return async (triggerInput, context) => {
        try {
            return await handler(triggerInput, context);
        } catch (err) {
            const serialized = buildTaskFailureDetailsJson(err);
            if (!serialized) {
                throw err;
            }
            const original = err instanceof Error ? err : new Error(String(err));
            let assigned = true;
            try {
                original.message = serialized;
            } catch {
                assigned = false;
            }
            if (assigned) {
                throw original;
            }
            // `message` is non-writable on some custom Error subclasses;
            // fall back to a fresh Error that preserves the original stack.
            const wrapped = new Error(serialized);
            wrapped.stack = original.stack;
            throw wrapped;
        }
    };
}

export * as client from "./client";
