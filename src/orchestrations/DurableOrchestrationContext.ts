import { TaskOrchestrationExecutor } from "./TaskOrchestrationExecutor";
import { WhenAllAction } from "../actions/WhenAllAction";
import { WhenAnyAction } from "../actions/WhenAnyAction";
import {
    WhenAllTask,
    WhenAnyTask,
    AtomicTask,
    LockTask,
    RetryableTask,
    DFTimerTask,
    DFTask,
    LongTimerTask,
    CallHttpWithPollingTask,
} from "../task";
import moment = require("moment");
import { ReplaySchema } from "./ReplaySchema";
import { CallHttpOptions, Task, TimerTask } from "durable-functions";
import * as types from "durable-functions";
import { SignalEntityAction } from "../actions/SignalEntityAction";
import { CallActivityAction } from "../actions/CallActivityAction";
import { CallActivityWithRetryAction } from "../actions/CallActivityWithRetryAction";
import { CallEntityAction } from "../actions/CallEntityAction";
import { CallHttpAction } from "../actions/CallHttpAction";
import { CallSubOrchestratorAction } from "../actions/CallSubOrchestratorAction";
import { CallSubOrchestratorWithRetryAction } from "../actions/CallSubOrchestratorWithRetryAction";
import { ContinueAsNewAction } from "../actions/ContinueAsNewAction";
import { CreateTimerAction } from "../actions/CreateTimerAction";
import { ExternalEventType } from "../actions/ExternalEventType";
import { LockEntitiesAction } from "../actions/LockEntitiesAction";
import { ReleaseEntitiesAction } from "../actions/ReleaseEntitiesAction";
import { WaitForExternalEventAction } from "../actions/WaitForExternalEventAction";
import { GuidManager } from "../util/GuidManager";
import { HistoryEvent } from "../history/HistoryEvent";
import { DurableHttpRequest } from "../http/DurableHttpRequest";
import { HistoryEventType } from "../history/HistoryEventType";
import { ExecutionStartedEvent } from "../history/ExecutionStartedEvent";
import { DurableLock } from "../entities/DurableLock";
import { EntityId } from "../entities/EntityId";
import { LockState } from "../entities/LockState";
import {
    LockingRulesViolationError,
    LockingRulesViolationMessages,
} from "../error/LockingRulesViolationError";

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
        this.version = this.extractVersionFromHistory(state);
    }

    private input: unknown;
    private readonly state: HistoryEvent[];
    private newGuidCounter: number;
    public customStatus: unknown;
    public readonly version: string | undefined;

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

    /**
     * Extracts the version value from the ExecutionStarted event in the history
     * @param state The history events array
     * @returns The version string from ExecutionStartedEvent, or undefined if not found
     */
    private extractVersionFromHistory(state: HistoryEvent[]): string | undefined {
        const executionStartedEvent = state.find(
            (e) => e.EventType === HistoryEventType.ExecutionStarted
        ) as ExecutionStartedEvent | undefined;

        return executionStartedEvent?.Version;
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

    public callActivityWithRetry(
        name: string,
        retryOptions: types.RetryOptions,
        input?: unknown
    ): Task {
        const newAction = new CallActivityWithRetryAction(name, retryOptions, input);
        const backingTask = new AtomicTask(false, newAction);
        const task = new RetryableTask(backingTask, retryOptions);
        return task;
    }

    public callEntity(
        entityId: types.EntityId,
        operationName: string,
        operationInput?: unknown
    ): Task {
        // Critical-section rules.
        if (this.currentLock !== undefined) {
            const targetSchedulerId = EntityId.getSchedulerIdFromEntityId(entityId as EntityId);
            const isLocked = this.currentLock.ownedLocks.some(
                (e) => EntityId.getSchedulerIdFromEntityId(e) === targetSchedulerId
            );
            if (!isLocked) {
                throw new LockingRulesViolationError(
                    LockingRulesViolationMessages.CallUnlockedEntity
                );
            }
            if (this.currentLock.inFlightEntityCalls.has(targetSchedulerId)) {
                throw new LockingRulesViolationError(
                    LockingRulesViolationMessages.ParallelSameEntity
                );
            }
            this.currentLock.inFlightEntityCalls.add(targetSchedulerId);
        }
        const newAction = new CallEntityAction(entityId, operationName, operationInput);
        const task = new AtomicTask(false, newAction);
        return task;
    }
    public signalEntity(
        entityId: types.EntityId,
        operationName: string,
        operationInput?: unknown
    ): void {
        if (this.currentLock !== undefined) {
            const targetSchedulerId = EntityId.getSchedulerIdFromEntityId(entityId as EntityId);
            const isLocked = this.currentLock.ownedLocks.some(
                (e) => EntityId.getSchedulerIdFromEntityId(e) === targetSchedulerId
            );
            if (isLocked) {
                throw new LockingRulesViolationError(
                    LockingRulesViolationMessages.SignalLockedEntity
                );
            }
        }
        const action = new SignalEntityAction(entityId, operationName, operationInput);
        this.taskOrchestratorExecutor.recordFireAndForgetAction(action);
    }

    public callSubOrchestrator(
        name: string,
        input?: unknown,
        instanceId?: string,
        version?: string
    ): Task {
        if (!name) {
            throw new Error(
                "A sub-orchestration function name must be provided when attempting to create a suborchestration"
            );
        }
        if (this.currentLock !== undefined) {
            throw new LockingRulesViolationError(
                LockingRulesViolationMessages.SubOrchestrationInSection
            );
        }

        const newAction = new CallSubOrchestratorAction(name, instanceId, input, version);
        const task = new AtomicTask(false, newAction);
        return task;
    }

    public callSubOrchestratorWithRetry(
        name: string,
        retryOptions: types.RetryOptions,
        input?: unknown,
        instanceId?: string,
        version?: string
    ): Task {
        if (!name) {
            throw new Error(
                "A sub-orchestration function name must be provided when attempting to create a suborchestration"
            );
        }
        if (this.currentLock !== undefined) {
            throw new LockingRulesViolationError(
                LockingRulesViolationMessages.SubOrchestrationInSection
            );
        }

        const newAction = new CallSubOrchestratorWithRetryAction(
            name,
            retryOptions,
            input,
            instanceId,
            version
        );
        const backingTask = new AtomicTask(false, newAction);
        const task = new RetryableTask(backingTask, retryOptions);
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

    /**
     * @hidden
     * Tracks the active (or pending) critical section (if any). Set when `lock(...)` is scheduled;
     * cleared when `release()` is invoked.
     */
    private currentLock: DurableLock | undefined;

    /**
     * @hidden
     * Called by the executor when a `callEntity` task resolves (success or
     * failure) so the "no parallel call to same locked entity" rule no
     * longer treats the call as in flight.
     */
    public _onEntityCallResolved(schedulerId: string): void {
        if (this.currentLock === undefined) {
            return;
        }
        this.currentLock.inFlightEntityCalls.delete(schedulerId);
    }

    /**
     * Acquires one or more entity locks, atomically, forming a critical
     * section. Yield the returned task to receive a `DurableLock`.
     *
     * Supports both varargs and array form:
     *   ctx.df.lock(a, b)
     *   ctx.df.lock([a, b])
     *
     * @throws RangeError if no entities are supplied (zero arguments or empty array).
     * @throws TypeError if any element is not an EntityId.
     * @throws LockingRulesViolationError if called from inside an existing
     *         critical section.
     * @throws Error if the negotiated extension protocol does not support
     *         critical sections (requires schema V4 or newer).
     *
     * @remarks
     * **Replay-protocol contract:** the wire shape on replay is identical
     * to `callEntity`. The extension sends a `RequestMessage`
     * (history `EventSent`, with `Input.id` = lock-request GUID) and awaits
     * an `EventRaised` whose `Name` equals that same GUID. The executor's
     * `EventSent` handler re-keys this task to that GUID, so the subsequent
     * `EventRaised` matches and resolves the lock task — without requiring
     * any new history event type.
     */
    public lock(first: types.EntityId | types.EntityId[], ...rest: types.EntityId[]): Task {
        if (this.schemaVersion < ReplaySchema.V4) {
            throw new Error(
                `lock requires a Durable Functions extension that advertises OOProc schema V4 or higher (negotiated V${
                    (this.schemaVersion as number) + 1
                }). Please upgrade the Microsoft.Azure.WebJobs.Extensions.DurableTask package.`
            );
        }

        // Reject the no-args case up front. Without this check, normalization
        // below would produce `[undefined]` and surface a TypeError, which
        // contradicts the documented RangeError contract.
        if (typeof first === "undefined" && rest.length === 0) {
            throw new RangeError("lock requires at least one EntityId");
        }

        // Normalize varargs vs array form.
        const entitiesRaw: unknown[] = Array.isArray(first) ? first : [first, ...rest];

        if (entitiesRaw.length === 0) {
            throw new RangeError("lock requires at least one EntityId");
        }
        for (const e of entitiesRaw) {
            if (!(e instanceof EntityId)) {
                throw new TypeError("lock expected EntityId[]");
            }
        }

        if (this.currentLock !== undefined) {
            throw new LockingRulesViolationError(LockingRulesViolationMessages.NestedSection);
        }

        const entities = entitiesRaw as EntityId[];

        // Sort by scheduler id, then dedupe consecutive duplicates.
        const sorted = [...entities].sort((a, b) => {
            const aId = EntityId.getSchedulerIdFromEntityId(a);
            const bId = EntityId.getSchedulerIdFromEntityId(b);
            return aId < bId ? -1 : aId > bId ? 1 : 0;
        });
        const deduped = sorted.filter(
            (e, i, arr) =>
                i === 0 ||
                EntityId.getSchedulerIdFromEntityId(arr[i - 1]) !==
                    EntityId.getSchedulerIdFromEntityId(e)
        );

        const lockRequestId = this.newGuid(this.instanceId);
        const action = new LockEntitiesAction(deduped, lockRequestId);

        // The DurableLock the orchestrator generator receives on
        // `yield ctx.df.lock(...)`. It is carried on the returned LockTask as a
        // typed field (see LockTask), so the executor can hand it back on
        // completion without a shared untyped property between the two.
        const lock = new DurableLock(deduped, () => {
            this.taskOrchestratorExecutor.recordFireAndForgetAction(new ReleaseEntitiesAction());
            // Clear the active-section flag so subsequent code outside the
            // section is no longer treated as locked.
            if (this.currentLock === lock) {
                this.currentLock = undefined;
            }
        });

        const task = new LockTask(action, lock);

        // Activate the section eagerly so subsequent yielded callEntity/etc
        // inside the same generator frame see the rules. The lock won't
        // *actually* be acquired by the extension until the action completes,
        // but rule enforcement is purely worker-side bookkeeping and we want
        // it to behave the same on first execution and on replay.
        this.currentLock = lock;

        return task;
    }

    /**
     * Returns whether the orchestration is currently inside a critical
     * section and, if so, which entities are locked.
     */
    public isLocked(): LockState {
        if (this.currentLock === undefined) {
            return new LockState(false, []);
        }
        return new LockState(true, [...this.currentLock.ownedLocks]);
    }
}
