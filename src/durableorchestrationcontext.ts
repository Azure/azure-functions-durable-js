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
    DFTask,
    LongTimerTask,
    CallHttpWithPollingTask,
} from "./task";
import moment = require("moment");
import { ReplaySchema } from "./replaySchema";
import { CallHttpOptions, CallSubOrchestratorOptions, Task, TimerTask } from "durable-functions";
import * as types from "durable-functions";
import { SignalEntityAction } from "./actions/signalentityaction";

/**
 * Parameter data for orchestration bindings that can be used to schedule
 * function-based activities.
 */
export class DurableOrchestrationContext implements types.DurableOrchestrationContext {
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
        this.defaultHttpAsyncRequestSleepTimeMillseconds = defaultHttpAsyncRequestSleepTimeMillseconds;
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
    private readonly defaultHttpAsyncRequestSleepTimeMillseconds?: number;

    public readonly instanceId: string;
    public readonly parentInstanceId: string | undefined;
    public isReplaying: boolean;
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

    public callActivity(name: string, input?: unknown): Task {
        const newAction = new CallActivityAction(name, input);
        const task = new AtomicTask(false, newAction);
        return task;
    }

    public callActivityWithRetry(name: string, retryOptions: RetryOptions, input?: unknown): Task {
        const newAction = new CallActivityWithRetryAction(name, retryOptions, input);
        const backingTask = new AtomicTask(false, newAction);
        const task = new RetryableTask(backingTask, retryOptions, this.taskOrchestratorExecutor);
        return task;
    }

    public callEntity(entityId: EntityId, operationName: string, operationInput?: unknown): Task {
        const newAction = new CallEntityAction(entityId, operationName, operationInput);
        const task = new AtomicTask(false, newAction);
        return task;
    }
    public signalEntity(entityId: EntityId, operationName: string, operationInput?: unknown): void {
        const action = new SignalEntityAction(entityId, operationName, operationInput);
        this.taskOrchestratorExecutor.recordFireAndForgetAction(action);
    }

    public callSubOrchestrator(name: string, options: CallSubOrchestratorOptions = {}): Task {
        if (!name) {
            throw new Error(
                "A sub-orchestration function name must be provided when attempting to create a suborchestration"
            );
        }

        const newAction = new CallSubOrchestratorAction(name, options.instanceId, options.input);
        const task = new AtomicTask(false, newAction);
        return task;
    }

    public callSubOrchestratorWithRetry(
        name: string,
        retryOptions: RetryOptions,
        options: CallSubOrchestratorOptions = {}
    ): Task {
        if (!name) {
            throw new Error(
                "A sub-orchestration function name must be provided when attempting to create a suborchestration"
            );
        }

        const newAction = new CallSubOrchestratorWithRetryAction(
            name,
            retryOptions,
            options.input,
            options.instanceId
        );
        const backingTask = new AtomicTask(false, newAction);
        const task = new RetryableTask(backingTask, retryOptions, this.taskOrchestratorExecutor);
        return task;
    }

    public callHttp(options: CallHttpOptions): Task {
        let content = options.body;
        if (content && typeof content !== "string") {
            content = JSON.stringify(content);
        }

        let enablePolling = true;
        if (options.enablePolling !== undefined) {
            enablePolling = options.enablePolling;
        } else if (options.asynchronousPatternEnabled !== undefined) {
            enablePolling = options.asynchronousPatternEnabled;
        }
        const request = new DurableHttpRequest(
            options.method,
            options.url,
            content as string,
            options.headers,
            options.tokenSource,
            enablePolling
        );
        const newAction = new CallHttpAction(request);
        if (this.schemaVersion >= ReplaySchema.V3 && request.asynchronousPatternEnabled) {
            if (!this.defaultHttpAsyncRequestSleepTimeMillseconds) {
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
                this.defaultHttpAsyncRequestSleepTimeMillseconds
            );
        }
        return new AtomicTask(false, newAction);
    }

    public continueAsNew(input: unknown): void {
        const newAction = new ContinueAsNewAction(input);
        this.taskOrchestratorExecutor.addToActions(newAction);
        this.taskOrchestratorExecutor.willContinueAsNew = true;
    }

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

    public getInput<T>(): T {
        return this.input as T;
    }

    public newGuid(instanceId: string): string {
        const guidNameValue = `${instanceId}_${this.currentUtcDateTime.valueOf()}_${
            this.newGuidCounter
        }`;
        this.newGuidCounter++;
        return GuidManager.createDeterministicGuid(GuidManager.UrlNamespaceValue, guidNameValue);
    }

    public setCustomStatus(customStatusObject: unknown): void {
        this.customStatus = customStatusObject;
    }

    public waitForExternalEvent(name: string): Task {
        const newAction = new WaitForExternalEventAction(name, ExternalEventType.ExternalEvent);
        const task = new AtomicTask(name, newAction);
        return task;
    }
}
