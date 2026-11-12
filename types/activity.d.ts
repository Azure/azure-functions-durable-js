import {
    FunctionHandler,
    FunctionInput,
    FunctionOptions,
    FunctionOutput,
    FunctionTrigger,
    InvocationContext,
} from "@azure/functions";
import { RetryOptions, Task } from "durable-functions";

/**
 * Durable retry information supplied by the activity's scheduling host.
 */
export interface DurableActivityRetryContext {
    /** One-based attempt number. Redelivery does not increment this value. */
    readonly attemptNumber: number;
    /** Maximum attempts, including the initial attempt. The policy may stop earlier. */
    readonly maxAttempts: number;
    /**
     * Correlation identifier shared across attempts and replay of one logical activity call.
     * This is not an idempotency key.
     */
    readonly retryGroupId: string;
}

/**
 * The existing Functions invocation context, decorated with durable activity retry information.
 */
export interface DurableActivityContext extends InvocationContext {
    /**
     * Present from attempt 1 when the host supplies a durable retry policy's metadata.
     * Absent without a policy or with older components/history.
     * Independent of Functions host-managed `retryContext`.
     */
    readonly activityRetryContext?: DurableActivityRetryContext;
}

export type ActivityHandler = (
    triggerInput: Parameters<FunctionHandler>[0],
    context: DurableActivityContext
) => ReturnType<FunctionHandler>;

export interface ActivityOptions extends Partial<FunctionOptions> {
    handler: ActivityHandler;
    extraInputs?: FunctionInput[];
    extraOutputs?: FunctionOutput[];
}

export interface ActivityTrigger extends FunctionTrigger {
    type: "activityTrigger";
}

export type RegisteredActivity = (input?: unknown) => RegisteredActivityTask;

export interface RegisteredActivityTask extends Task {
    withRetry: (retryOptions: RetryOptions) => Task;
}
