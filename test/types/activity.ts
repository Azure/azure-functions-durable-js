import { FunctionHandler, InvocationContext } from "@azure/functions";
import {
    ActivityHandler,
    DurableActivityContext,
    DurableActivityRetryContext,
    app,
} from "durable-functions";

// Compile-only checks; this function is never invoked.
export function checkActivityTypes(
    legacyHandler: FunctionHandler,
    context: DurableActivityContext,
    retry: DurableActivityRetryContext
): void {
    const activityHandler: ActivityHandler = legacyHandler;
    const functionsHandler: FunctionHandler = activityHandler;
    const baseContext: InvocationContext = context;
    const optionalContext: DurableActivityContext = baseContext;

    app.activity("legacy", { handler: functionsHandler });
    app.activity("explicit-context", {
        handler: (input: string, invocation: InvocationContext): string =>
            input + invocation.invocationId,
    });
    app.activity("durable-context", {
        handler: async (input, invocation) => {
            const retryContext: DurableActivityRetryContext | undefined =
                invocation.activityRetryContext;
            return { input, retryContext, optionalContext };
        },
    });

    // @ts-expect-error Durable retry context is read-only.
    context.activityRetryContext = retry;
    // @ts-expect-error Attempt number is read-only.
    retry.attemptNumber = 2;
    // @ts-expect-error Maximum attempts is read-only.
    retry.maxAttempts = 3;
    // @ts-expect-error Group ID is read-only.
    retry.retryGroupId = "changed";
}
