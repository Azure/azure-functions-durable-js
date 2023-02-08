import { FunctionOptions, FunctionTrigger, InvocationContext, LogHandler } from "@azure/functions";
import { TokenSource } from ".";
import { DurableOrchestrationContext } from "../classes";

/**
 * Type of a Generator that can be registered as an orchestration
 */
export type OrchestrationHandler = (
    context: OrchestrationContext
) => Generator<unknown, unknown, any>;

/**
 * Context object passed to orchestration Functions.
 */
export interface OrchestrationContext extends InvocationContext {
    /**
     * Object containing all DF orchestration APIs and properties
     */
    df: DurableOrchestrationContext;
}

/**
 * An orchestration context with dummy default values to facilitate mocking/stubbing the
 * Durable Functions API.
 */
export declare class DummyOrchestrationContext extends InvocationContext
    implements OrchestrationContext {
    /**
     * Creates a new instance of a dummy orchestration context.
     * All parameters are optional but are exposed to enable flexibility
     * in the testing process.
     *
     * @param functionName The name of the orchestration function
     * @param invocationId The ID of this particular invocation of the orchestration
     * @param logHandler A handler to emit logs coming from the orchestration function
     */
    constructor(functionName?: string, invocationId?: string, logHandler?: LogHandler);

    df: DurableOrchestrationContext;
}

export interface OrchestrationOptions extends Partial<FunctionOptions> {
    handler: OrchestrationHandler;
}

export interface OrchestrationTrigger extends FunctionTrigger {
    type: "orchestrationTrigger";
}

/**
 * Options object provided to `callHttp()` methods on orchestration contexts
 */
export interface CallHttpOptions {
    /**
     * The HTTP request method.
     */
    method: string;
    /**
     * The HTTP request URL.
     */
    url: string;
    /**
     * The HTTP request body.
     */
    body?: string | object;
    /**
     * The HTTP request headers.
     */
    headers?: { [key: string]: string };
    /**
     * The source of the OAuth token to add to the request.
     */
    tokenSource?: TokenSource;
    /**
     * Specifies whether to continue polling the request after receiving a 202 response.
     * This replaces `asynchronousPatternEnabled`. If both are specified,
     * `enablePolling` takes precedence.
     *
     * @default true
     */
    enablePolling?: boolean;
    /**
     * @deprecated use `enablePolling` instead. If both are specified,
     * `enablePolling` takes precedence.
     */
    asynchronousPatternEnabled?: boolean;
}

/**
 * Represents the status of a durable orchestration instance.
 *
 * Can be fetched using `DurableClient.getStatus()`
 */
export declare class DurableOrchestrationStatus {
    /**
     * The orchestrator function name.
     */
    readonly name: string;

    /**
     * The unique ID of the instance.
     *
     * The instance ID is generated and fixed when the orchestrator
     * function is scheduled. It can either auto-generated, in which case
     * it is formatted as a GUID, or it can be user-specified with any
     * format.
     */
    readonly instanceId: string;

    /**
     * The time at which the orchestration instance was created.
     *
     * If the orchestration instance is in the [[Pending]] status, this
     * time represents the time at which the orchestration instance was
     * scheduled.
     */
    readonly createdTime: Date;

    /**
     * The time at which the orchestration instance last updated its
     * execution history.
     */
    readonly lastUpdatedTime: Date;

    /**
     * The input of the orchestration instance.
     */
    readonly input: unknown;

    /**
     * The output of the orchestration instance.
     */
    readonly output: unknown;

    /**
     * The runtime status of the orchestration instance.
     */
    readonly runtimeStatus: OrchestrationRuntimeStatus;

    /**
     * The custom status payload (if any) that was set by
     * `DurableOrchestrationClient.setCustomStatus()`.
     */
    readonly customStatus?: unknown;

    /**
     * The execution history of the orchestration instance.
     *
     * The history log can be large and is therefore `undefined` by
     * default. It is populated only when explicitly requested in the call
     * to `DurableOrchestrationClient.getStatus()`.
     */
    readonly history?: Array<unknown>;
}

/**
 * The status of an orchestration instance.
 */
export enum OrchestrationRuntimeStatus {
    /**
     * The orchestration instance has started running.
     */
    Running = "Running",

    /**
     * The orchestration instance has completed normally.
     */
    Completed = "Completed",

    /**
     * The orchestration instance has restarted itself with a new history.
     * This is a transient state.
     */
    ContinuedAsNew = "ContinuedAsNew",

    /**
     * The orchestration instance failed with an error.
     */
    Failed = "Failed",

    /**
     * The orchestration was canceled gracefully.
     */
    Canceled = "Canceled",

    /**
     * The orchestration instance was stopped abruptly.
     */
    Terminated = "Terminated",

    /**
     * The orchestration instance has been scheduled but has not yet started
     * running.
     */
    Pending = "Pending",
}
