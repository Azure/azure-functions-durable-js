import { FunctionOptions, FunctionTrigger, InvocationContext, LogHandler } from "@azure/functions";
import { RetryOptions, Task, TimerTask, TokenSource } from ".";
import { EntityId } from "./entity";

/**
 * Type of a Generator that can be registered as an orchestration
 */
export type OrchestrationHandler = (
    context: OrchestrationContext
) => Generator<
    Task, // orchestrations can only yield Task types
    unknown, // return type of the orchestration
    any // what the SDK passes back to the orchestration
>;

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

export type RegisteredOrchestration = (
    input?: unknown,
    instanceId?: string
) => RegisteredOrchestrationTask;

export interface RegisteredOrchestrationTask extends Task {
    withRetry: (retryOptions: RetryOptions) => Task;
}

/**
 * Provides functionality for application code implementing an orchestration operation.
 */
export declare class DurableOrchestrationContext {
    /**
     * The ID of the current orchestration instance.
     *
     * The instance ID is generated and fixed when the orchestrator function is
     * scheduled. It can be either auto-generated, in which case it is
     * formatted as a GUID, or it can be user-specified with any format.
     */
    readonly instanceId: string;

    /**
     * The ID of the parent orchestration of the current sub-orchestration
     * instance. The value will be available only in sub-orchestrations.
     *
     * The parent instance ID is generated and fixed when the parent
     * orchestrator function is scheduled. It can be either auto-generated, in
     * which case it is formatted as a GUID, or it can be user-specified with
     * any format.
     */
    readonly parentInstanceId: string | undefined;

    /**
     * Gets a value indicating whether the orchestrator function is currently
     * replaying itself.
     *
     * This property is useful when there is logic that needs to run only when
     * the orchestrator function is _not_ replaying. For example, certain types
     * of application logging may become too noisy when duplicated as part of
     * orchestrator function replay. The orchestrator code could check to see
     * whether the function is being replayed and then issue the log statements
     * when this value is `false`.
     */
    isReplaying: boolean;

    /**
     * Gets the current date/time in a way that is safe for use by orchestrator
     * functions.
     *
     * This date/time value is derived from the orchestration history. It
     * always returns the same value at specific points in the orchestrator
     * function code, making it deterministic and safe for replay.
     */
    currentUtcDateTime: Date;

    /**
     * Custom status for the orchestration
     */
    customStatus: unknown;

    /**
     * Entry point for methods to handle collections of
     * pending actions represented by [[Task]] instances.
     * For use in parallelization operations.
     */
    Task: {
        /**
         * Returns when _all_ the children Tasks have completed
         * @param tasks the list of Tasks to wait on
         * @returns a Task with the result of all of the awaited Tasks
         */
        all: (tasks: Task[]) => Task;
        /**
         * Returns when _any_ of the children Tasks have completed
         * @param tasks the lists of Tasks to run
         * @returns the first Task from tasks to complete
         */
        any: (tasks: Task[]) => Task;
    };

    /**
     * Schedules an activity function named `name` for execution.
     *
     * @param name The name of the activity function to call.
     * @param input The JSON-serializable input to pass to the activity
     * function.
     *
     * @returns A Durable Task that completes when the called activity
     * function completes or fails.
     */
    callActivity(name: string, input?: unknown): Task;

    /**
     * Schedules an activity function named `name` for execution with
     * retry options.
     *
     * @param name The name of the activity function to call.
     * @param retryOptions The retry options for the activity function.
     * @param input The JSON-serializable input to pass to the activity
     * function.
     */
    callActivityWithRetry(name: string, retryOptions: RetryOptions, input?: unknown): Task;

    /**
     * Calls an operation on an entity, passing an argument, and waits for it
     * to complete.
     *
     * @param entityId The target entity.
     * @param operationName The name of the operation.
     * @param operationInput The input for the operation.
     */
    callEntity(entityId: EntityId, operationName: string, operationInput?: unknown): Task;

    /**
     * Send a signal operation to a Durable Entity, passing an argument, without
     * waiting for a response. A fire-and-forget operation.
     *
     * @param entityId ID of the target entity.
     * @param operationName The name of the operation.
     * @param operationInput (optional) input for the operation.
     */
    signalEntity(entityId: EntityId, operationName: string, operationInput?: unknown): void;

    /**
     * Schedules an orchestration function named `name` for execution.
     *
     * @param name The name of the orchestrator function to call.
     * @param input The JSON-serializable input to pass to the orchestrator
     * function.
     * @param instanceId A unique ID to use for the sub-orchestration instance.
     * If `instanceId` is not specified, the extension will generate an id in
     * the format `<calling orchestrator instance ID>:<#>`
     */
    callSubOrchestrator(name: string, input?: unknown, instanceId?: string): Task;

    /**
     * Schedules an orchestrator function named `name` for execution with retry
     * options.
     *
     * @param name The name of the orchestrator function to call.
     * @param retryOptions The retry options for the orchestrator function.
     * @param input The JSON-serializable input to pass to the orchestrator
     * function.
     * @param instanceId A unique ID to use for the sub-orchestration instance.
     */
    callSubOrchestratorWithRetry(
        name: string,
        retryOptions: RetryOptions,
        input?: unknown,
        instanceId?: string
    ): Task;

    /**
     * Schedules a durable HTTP call to the specified endpoint.
     *
     * @param options The HTTP options object
     */
    callHttp(options: CallHttpOptions): Task;

    /**
     * Restarts the orchestration by clearing its history.
     *
     * @param input The JSON-serializable data to re-initialize the instance with.
     */
    continueAsNew(input: unknown): void;

    /**
     * Creates a durable timer that expires at a specified time.
     *
     * All durable timers created using this method must either expire or be
     * cancelled using `TimerTask.cancel()` before the orchestrator
     * function completes. Otherwise, the underlying framework will keep the
     * instance alive until the timer expires.
     *
     * @param fireAt The time at which the timer should expire.
     * @returns A TimerTask that completes when the durable timer expires.
     */
    createTimer(fireAt: Date): TimerTask;

    /**
     * Gets the input of the current orchestrator function as a deserialized
     * value.
     *
     * @param T return input as type `T`
     */
    getInput<T>(): T;

    /**
     * Creates a new GUID that is safe for replay within an orchestration or
     * operation.
     *
     * The default implementation of this method creates a name-based UUID
     * using the algorithm from RFC 4122 §4.3. The name input used to generate
     * this value is a combination of the orchestration instance ID and an
     * internally managed sequence number.
     *
     * @param input used to generate the unique GUID
     */
    newGuid(input: string): string;

    /**
     * Sets the JSON-serializable status of the current orchestrator function.
     *
     * The `customStatusObject` value is serialized to JSON and will be made
     * available to the orchestration status query APIs. The serialized JSON
     * value must not exceed 16 KB of UTF-16 encoded text.
     *
     * The serialized `customStatusObject` value will be made available to the
     * aforementioned APIs after the next `yield` or `return` statement.
     *
     * @param customStatusObject The JSON-serializable value to use as the
     * orchestrator function's custom status.
     */
    setCustomStatus(customStatusObject: unknown): void;

    /**
     * Waits asynchronously for an event to be raised with the name `name` and
     * returns the event data.
     *
     * External clients can raise events to a waiting orchestration instance
     * using `raiseEvent()`.
     *
     * @param name The name of the external event to wait for.
     * @returns a Task that completes when an external event of
     *  the specified name is received
     */
    waitForExternalEvent(name: string): Task;
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
     * `DurableClient.setCustomStatus()`.
     */
    readonly customStatus?: unknown;

    /**
     * The execution history of the orchestration instance.
     *
     * The history log can be large and is therefore `undefined` by
     * default. It is populated only when explicitly requested in the call
     * to `DurableClient.getStatus()`.
     */
    readonly history?: Array<unknown>;
}

/**
 * The status of an orchestration instance.
 */
export declare enum OrchestrationRuntimeStatus {
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
