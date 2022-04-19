import { TokenSource } from "./tokensource";
import {
    EntityId,
    RetryOptions,
    CallActivityAction,
    CallActivityWithRetryAction,
    CallEntityAction,
    CallHttpAction,
    CallSubOrchestratorAction,
    CallSubOrchestratorWithRetryAction,
    ContinueAsNewAction,
    CreateTimerAction,
    DurableHttpRequest,
    ExternalEventType,
    GuidManager,
    HistoryEvent,
    WaitForExternalEventAction,
} from "./classes";
import { TaskOrchestrationExecutor } from "./taskorchestrationexecutor";
import { WhenAllAction } from "./actions/whenallaction";
import { WhenAnyAction } from "./actions/whenanyaction";
import {
    WhenAllTask,
    WhenAnyTask,
    AtomicTask,
    RetryableTask,
    DFTimerTask,
    Task,
    TimerTask,
    DFTask,
    LongTimerTask,
    CallHttpWithPollingTask,
} from "./task";
import moment = require("moment");
import { ReplaySchema } from "./replaySchema";

/**
 * Parameter data for orchestration bindings that can be used to schedule
 * function-based activities.
 */
export class DurableOrchestrationContext {
    constructor(
        state: HistoryEvent[],
        instanceId: string,
        currentUtcDateTime: Date,
        isReplaying: boolean,
        parentInstanceId: string | undefined,
        longRunningTimerIntervalDuration: string | undefined,
        maximumShortTimerDuration: string | undefined,
        defaultHttpAsyncRequestSleepTimeMillseconds: number | undefined,
        schemaVersion: ReplaySchema,
        input: unknown,
        private taskOrchestratorExecutor: TaskOrchestrationExecutor
    ) {
        this.state = state;
        this.instanceId = instanceId;
        this.isReplaying = isReplaying;
        this.currentUtcDateTime = currentUtcDateTime;
        this.parentInstanceId = parentInstanceId;
        this.longRunningTimerIntervalDuration = longRunningTimerIntervalDuration
            ? moment.duration(longRunningTimerIntervalDuration)
            : undefined;
        this.maximumShortTimerDuration = maximumShortTimerDuration
            ? moment.duration(maximumShortTimerDuration)
            : undefined;
        this.defaultHttpAsyncRequestSleepDuration = defaultHttpAsyncRequestSleepTimeMillseconds
            ? moment.duration(defaultHttpAsyncRequestSleepTimeMillseconds, "ms")
            : undefined;
        this.schemaVersion = schemaVersion;
        this.input = input;
        this.newGuidCounter = 0;
    }

    private input: unknown;
    private readonly state: HistoryEvent[];
    private newGuidCounter: number;
    public customStatus: unknown;

    /**
     * The default time to wait between attempts when making HTTP polling requests
     * This duration is used unless a different value (in seconds) is specified in the
     * 'Retry-After' header of the 202 response.
     */
    private readonly defaultHttpAsyncRequestSleepDuration?: moment.Duration;

    /**
     * The ID of the current orchestration instance.
     *
     * The instance ID is generated and fixed when the orchestrator function is
     * scheduled. It can be either auto-generated, in which case it is
     * formatted as a GUID, or it can be user-specified with any format.
     */
    public readonly instanceId: string;

    /**
     * The ID of the parent orchestration of the current sub-orchestration
     * instance. The value will be available only in sub-orchestrations.
     *
     * The parent instance ID is generated and fixed when the parent
     * orchestrator function is scheduled. It can be either auto-generated, in
     * which case it is formatted as a GUID, or it can be user-specified with
     * any format.
     */
    public readonly parentInstanceId: string | undefined;

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
    public isReplaying: boolean;

    /**
     * Gets the current date/time in a way that is safe for use by orchestrator
     * functions.
     *
     * This date/time value is derived from the orchestration history. It
     * always returns the same value at specific points in the orchestrator
     * function code, making it deterministic and safe for replay.
     */
    public currentUtcDateTime: Date;

    /**
     * Gets the maximum duration for timers allowed by the
     * underlying storage infrastructure
     *
     * This duration property is determined by the underlying storage
     * solution and passed to the SDK from the extension.
     */
    private readonly maximumShortTimerDuration: moment.Duration | undefined;

    /**
     * A duration property which defines the duration of smaller
     * timers to break long timers into, in case they are longer
     * than the maximum supported duration
     *
     * This duration property is determined by the underlying
     * storage solution and passed to the SDK from the extension.
     */
    private readonly longRunningTimerIntervalDuration: moment.Duration | undefined;

    /**
     * Gets the current schema version that this execution is
     * utilizing, based on negotiation with the extension.
     *
     * Different schema versions can allow different behavior.
     * For example, long timers are only supported in schema version >=3
     */
    private readonly schemaVersion: ReplaySchema;

    /**
     * @hidden
     * This method informs the type-checker that an ITask[] can be treated as DFTask[].
     * This is required for type-checking in the Task.all and Task.any method bodies while
     * preventing the DFTask type from being exported to users.
     * @param tasks
     */
    private isDFTaskArray(tasks: Task[]): tasks is DFTask[] {
        return tasks.every((x) => x instanceof DFTask);
    }

    /**
     * Just an entry point to reference the methods in [[ITaskMethods]].
     * Methods to handle collections of pending actions represented by [[Task]]
     * instances. For use in parallelization operations.
     */
    public Task = {
        all: (tasks: Task[]): Task => {
            if (this.isDFTaskArray(tasks)) {
                const action = new WhenAllAction(tasks);
                const task = new WhenAllTask(tasks, action);
                return task;
            }
            throw Error(
                "Task.all received a non-valid input. " +
                    "This may occur if it somehow received a non-list input, " +
                    "or if the input list's Tasks were corrupted. Please review your orchestrator code and/or file an issue."
            );
        },

        any: (tasks: Task[]): Task => {
            if (this.isDFTaskArray(tasks)) {
                const action = new WhenAnyAction(tasks);
                const task = new WhenAnyTask(tasks, action);
                return task;
            }
            throw Error(
                "Task.any received a non-valid input. " +
                    "This may occur if it somehow received a non-list input, " +
                    "or if the input list's Tasks were corrupted. Please review your orchestrator code and/or file an issue."
            );
        },
    };

    /**
     * Schedules an activity function named `name` for execution.
     *
     * @param name The name of the activity function to call.
     * @param input The JSON-serializable input to pass to the activity
     * function.
     * @returns A Durable Task that completes when the called activity
     * function completes or fails.
     */
    public callActivity(name: string, input?: unknown): Task {
        const newAction = new CallActivityAction(name, input);
        const task = new AtomicTask(false, newAction);
        return task;
    }

    /**
     * Schedules an activity function named `name` for execution with
     * retry options.
     *
     * @param name The name of the activity function to call.
     * @param retryOptions The retry options for the activity function.
     * @param input The JSON-serializable input to pass to the activity
     * function.
     */
    public callActivityWithRetry(name: string, retryOptions: RetryOptions, input?: unknown): Task {
        const newAction = new CallActivityWithRetryAction(name, retryOptions, input);
        const backingTask = new AtomicTask(false, newAction);
        const task = new RetryableTask(backingTask, retryOptions, this.taskOrchestratorExecutor);
        return task;
    }

    /**
     * Calls an operation on an entity, passing an argument, and waits for it
     * to complete.
     *
     * @param entityId The target entity.
     * @param operationName The name of the operation.
     * @param operationInput The input for the operation.
     */
    public callEntity(entityId: EntityId, operationName: string, operationInput?: unknown): Task {
        const newAction = new CallEntityAction(entityId, operationName, operationInput);
        const task = new AtomicTask(false, newAction);
        return task;
    }

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
    public callSubOrchestrator(name: string, input?: unknown, instanceId?: string): Task {
        if (!name) {
            throw new Error(
                "A sub-orchestration function name must be provided when attempting to create a suborchestration"
            );
        }

        const newAction = new CallSubOrchestratorAction(name, instanceId, input);
        const task = new AtomicTask(false, newAction);
        return task;
    }

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
    public callSubOrchestratorWithRetry(
        name: string,
        retryOptions: RetryOptions,
        input?: unknown,
        instanceId?: string
    ): Task {
        if (!name) {
            throw new Error(
                "A sub-orchestration function name must be provided when attempting to create a suborchestration"
            );
        }

        const newAction = new CallSubOrchestratorWithRetryAction(
            name,
            retryOptions,
            input,
            instanceId
        );
        const backingTask = new AtomicTask(false, newAction);
        const task = new RetryableTask(backingTask, retryOptions, this.taskOrchestratorExecutor);
        return task;
    }

    /**
     * Schedules a durable HTTP call to the specified endpoint.
     *
     * @param req The durable HTTP request to schedule.
     */
    public callHttp(
        method: string,
        uri: string,
        content?: string | object,
        headers?: { [key: string]: string },
        tokenSource?: TokenSource,
        asynchronousPatternEnabled?: boolean
    ): Task {
        if (content && typeof content !== "string") {
            content = JSON.stringify(content);
        }

        const req = new DurableHttpRequest(
            method,
            uri,
            content as string,
            headers,
            tokenSource,
            asynchronousPatternEnabled
        );
        const newAction = new CallHttpAction(req);
        if (this.schemaVersion >= ReplaySchema.V3 && req.asynchronousPatternEnabled) {
            if (!this.defaultHttpAsyncRequestSleepDuration) {
                throw Error(
                    "A framework-internal error was detected: replay schema version >= V3 is being used, " +
                        "but `defaultHttpAsyncRequestSleepDuration` property is not defined. " +
                        "This is likely an issue with the Durable Functions Extension. " +
                        "Please report this bug here: https://github.com/Azure/azure-functions-durable-js/issues"
                );
            }
            return new CallHttpWithPollingTask(
                false,
                newAction,
                this,
                this.taskOrchestratorExecutor,
                this.defaultHttpAsyncRequestSleepDuration.toISOString()
            );
        }
        return new AtomicTask(false, newAction);
    }

    /**
     * Restarts the orchestration by clearing its history.
     *
     * @param The JSON-serializable data to re-initialize the instance with.
     */
    public continueAsNew(input: unknown): void {
        const newAction = new ContinueAsNewAction(input);
        this.taskOrchestratorExecutor.addToActions(newAction);
        this.taskOrchestratorExecutor.willContinueAsNew = true;
    }

    /**
     * Creates a durable timer that expires at a specified time.
     *
     * All durable timers created using this method must either expire or be
     * cancelled using [[TimerTask]].[[cancel]] before the orchestrator
     * function completes. Otherwise, the underlying framework will keep the
     * instance alive until the timer expires.
     *
     * Timers currently cannot be scheduled further than 7 days into the
     * future.
     *
     * @param fireAt The time at which the timer should expire.
     * @returns A TimerTask that completes when the durable timer expires.
     */
    public createTimer(fireAt: Date): TimerTask {
        const timerAction = new CreateTimerAction(fireAt);
        const durationUntilFire = moment.duration(moment(fireAt).diff(this.currentUtcDateTime));
        if (this.schemaVersion >= ReplaySchema.V3) {
            if (!this.maximumShortTimerDuration || !this.longRunningTimerIntervalDuration) {
                throw Error(
                    "A framework-internal error was detected: replay schema version >= V3 is being used, " +
                        "but one or more of the properties `maximumShortTimerDuration` and `longRunningTimerIntervalDuration` are not defined. " +
                        "This is likely an issue with the Durable Functions Extension. " +
                        "Please report this bug here: https://github.com/Azure/azure-functions-durable-js/issues\n" +
                        `maximumShortTimerDuration: ${this.maximumShortTimerDuration}\n` +
                        `longRunningTimerIntervalDuration: ${this.longRunningTimerIntervalDuration}`
                );
            }

            if (durationUntilFire > this.maximumShortTimerDuration) {
                return new LongTimerTask(
                    false,
                    timerAction,
                    this,
                    this.taskOrchestratorExecutor,
                    this.maximumShortTimerDuration.toISOString(),
                    this.longRunningTimerIntervalDuration.toISOString()
                );
            }
        }

        return new DFTimerTask(false, timerAction);
    }

    /**
     * Gets the input of the current orchestrator function as a deserialized
     * value.
     */
    public getInput<T>(): T {
        return this.input as T;
    }

    /**
     * Creates a new GUID that is safe for replay within an orchestration or
     * operation.
     *
     * The default implementation of this method creates a name-based UUID
     * using the algorithm from RFC 4122 §4.3. The name input used to generate
     * this value is a combination of the orchestration instance ID and an
     * internally managed sequence number.
     */
    public newGuid(instanceId: string): string {
        const guidNameValue = `${instanceId}_${this.currentUtcDateTime.valueOf()}_${
            this.newGuidCounter
        }`;
        this.newGuidCounter++;
        return GuidManager.createDeterministicGuid(GuidManager.UrlNamespaceValue, guidNameValue);
    }

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
    public setCustomStatus(customStatusObject: unknown): void {
        this.customStatus = customStatusObject;
    }

    /**
     * Waits asynchronously for an event to be raised with the name `name` and
     * returns the event data.
     *
     * External clients can raise events to a waiting orchestration instance
     * using [[raiseEvent]].
     */
    public waitForExternalEvent(name: string): Task {
        const newAction = new WaitForExternalEventAction(name, ExternalEventType.ExternalEvent);
        const task = new AtomicTask(name, newAction);
        return task;
    }
}
