import { AggregatedError } from "./aggregatederror";
import { TokenSource } from "./tokensource";
import { DurableError } from "./durableerror";
import {
    EntityId,
    ITaskMethods,
    RetryOptions,
    Task,
    TimerTask,
    CallActivityAction,
    CallActivityWithRetryAction,
    CallEntityAction,
    CallHttpAction,
    CallSubOrchestratorAction,
    CallSubOrchestratorWithRetryAction,
    ContinueAsNewAction,
    CreateTimerAction,
    DurableHttpRequest,
    EventRaisedEvent,
    EventSentEvent,
    ExternalEventType,
    GuidManager,
    HistoryEvent,
    HistoryEventType,
    RequestMessage,
    ResponseMessage,
    SubOrchestrationInstanceCompletedEvent,
    SubOrchestrationInstanceCreatedEvent,
    SubOrchestrationInstanceFailedEvent,
    TaskCompletedEvent,
    TaskFactory,
    TaskFailedEvent,
    TaskFilter,
    TaskScheduledEvent,
    TimerCreatedEvent,
    TimerFiredEvent,
    WaitForExternalEventAction,
} from "./classes";
import { CompletedTask, TaskBase } from "./tasks/taskinterfaces";

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
        input: unknown
    ) {
        this.state = state;
        this.instanceId = instanceId;
        this.isReplaying = isReplaying;
        this.currentUtcDateTime = currentUtcDateTime;
        this.parentInstanceId = parentInstanceId;
        this.input = input;

        this.newGuidCounter = 0;
        this.subOrchestratorCounter = 0;
    }

    private input: unknown;
    private readonly state: HistoryEvent[];
    private newGuidCounter: number;
    private subOrchestratorCounter: number;
    public customStatus: unknown;

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
     * Just an entry point to reference the methods in [[ITaskMethods]].
     * Methods to handle collections of pending actions represented by [[Task]]
     * instances. For use in parallelization operations.
     */
    public Task: ITaskMethods = {
        all: (tasks: TaskBase[]) => {
            let maxCompletionIndex: number | undefined;
            const errors: Error[] = [];
            const results: Array<unknown> = [];
            for (const task of tasks) {
                if (!TaskFilter.isCompletedTask(task)) {
                    return TaskFactory.UncompletedTaskSet(tasks);
                }

                if (!maxCompletionIndex) {
                    maxCompletionIndex = task.completionIndex;
                } else if (maxCompletionIndex < task.completionIndex) {
                    maxCompletionIndex = task.completionIndex;
                }

                if (TaskFilter.isFailedTask(task)) {
                    errors.push(task.exception);
                } else {
                    results.push(task.result);
                }
            }

            // We are guaranteed that maxCompletionIndex is not undefined, or
            // we would have alreayd returned an uncompleted task set.
            const completionIndex = maxCompletionIndex as number;

            if (errors.length > 0) {
                return TaskFactory.FailedTaskSet(
                    tasks,
                    completionIndex,
                    new AggregatedError(errors)
                );
            } else {
                return TaskFactory.SuccessfulTaskSet(tasks, completionIndex, results);
            }
        },

        any: (tasks: Task[]) => {
            if (!tasks || tasks.length === 0) {
                throw new Error("At least one yieldable task must be provided to wait for.");
            }

            let firstCompleted: CompletedTask | undefined;
            for (const task of tasks) {
                if (TaskFilter.isCompletedTask(task)) {
                    if (!firstCompleted) {
                        firstCompleted = task;
                    } else if (task.completionIndex < firstCompleted.completionIndex) {
                        firstCompleted = task;
                    }
                }
            }

            if (firstCompleted) {
                return TaskFactory.SuccessfulTaskSet(
                    tasks,
                    firstCompleted.completionIndex,
                    firstCompleted
                );
            } else {
                return TaskFactory.UncompletedTaskSet(tasks);
            }
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

        const taskScheduled = this.findTaskScheduled(this.state, name);
        const taskCompleted = this.findTaskCompleted(this.state, taskScheduled);
        const taskFailed = this.findTaskFailed(this.state, taskScheduled);
        this.setProcessed([taskScheduled, taskCompleted, taskFailed]);

        if (taskCompleted) {
            const result = this.parseHistoryEvent(taskCompleted);

            return TaskFactory.SuccessfulTask(
                newAction,
                result,
                taskCompleted.Timestamp,
                taskCompleted.TaskScheduledId,
                this.state.indexOf(taskCompleted)
            );
        } else if (taskFailed) {
            return TaskFactory.FailedTask(
                newAction,
                taskFailed.Reason,
                taskFailed.Timestamp,
                taskFailed.TaskScheduledId,
                this.state.indexOf(taskFailed),
                new DurableError(taskFailed.Reason)
            );
        } else {
            return TaskFactory.UncompletedTask(newAction);
        }
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

        let attempt = 1;
        let taskScheduled: TaskScheduledEvent | undefined;
        let taskFailed: TaskFailedEvent | undefined;
        let taskRetryTimer: TimerCreatedEvent | undefined;
        for (let i = 0; i < this.state.length; i++) {
            const historyEvent = this.state[i];
            if (historyEvent.IsProcessed) {
                continue;
            }

            if (!taskScheduled) {
                if (historyEvent.EventType === HistoryEventType.TaskScheduled) {
                    if ((historyEvent as TaskScheduledEvent).Name === name) {
                        taskScheduled = historyEvent as TaskScheduledEvent;
                    }
                }
                continue;
            }

            if (historyEvent.EventType === HistoryEventType.TaskCompleted) {
                if (
                    (historyEvent as TaskCompletedEvent).TaskScheduledId === taskScheduled.EventId
                ) {
                    const taskCompleted = historyEvent as TaskCompletedEvent;
                    this.setProcessed([taskScheduled, taskCompleted]);
                    const result = this.parseHistoryEvent(taskCompleted);
                    return TaskFactory.SuccessfulTask(
                        newAction,
                        result,
                        taskCompleted.Timestamp,
                        taskCompleted.TaskScheduledId,
                        i
                    );
                } else {
                    continue;
                }
            }

            if (!taskFailed) {
                if (historyEvent.EventType === HistoryEventType.TaskFailed) {
                    if (
                        (historyEvent as TaskFailedEvent).TaskScheduledId === taskScheduled.EventId
                    ) {
                        taskFailed = historyEvent as TaskFailedEvent;
                    }
                }
                continue;
            }

            if (!taskRetryTimer) {
                if (historyEvent.EventType === HistoryEventType.TimerCreated) {
                    taskRetryTimer = historyEvent as TimerCreatedEvent;
                } else {
                    continue;
                }
            }

            if (historyEvent.EventType === HistoryEventType.TimerFired) {
                if ((historyEvent as TimerFiredEvent).TimerId === taskRetryTimer.EventId) {
                    const taskRetryTimerFired = historyEvent as TimerFiredEvent;
                    this.setProcessed([
                        taskScheduled,
                        taskFailed,
                        taskRetryTimer,
                        taskRetryTimerFired,
                    ]);
                    if (attempt >= retryOptions.maxNumberOfAttempts) {
                        return TaskFactory.FailedTask(
                            newAction,
                            taskFailed.Reason,
                            taskFailed.Timestamp,
                            taskFailed.TaskScheduledId,
                            i,
                            new DurableError(taskFailed.Reason)
                        );
                    } else {
                        attempt++;
                        taskScheduled = undefined;
                        taskFailed = undefined;
                        taskRetryTimer = undefined;
                    }
                } else {
                    continue;
                }
            }
        }

        return TaskFactory.UncompletedTask(newAction);
    }

    /**
     * Calls an operation on an entity, passing an argument, and waits for it
     * to complete.
     *
     * @param entityId The target entity.
     * @param operationName The name of the operation.
     * @param operationInput The input for the operation.
     */
    public callEntity(entityId: EntityId, operationName: string, operationInput: unknown): Task {
        const newAction = new CallEntityAction(entityId, operationName, operationInput);

        const schedulerId = EntityId.getSchedulerIdFromEntityId(entityId);
        const eventSent = this.findEventSent(this.state, schedulerId, "op");
        let eventRaised;
        if (eventSent) {
            const eventSentInput =
                eventSent && eventSent.Input
                    ? (JSON.parse(eventSent.Input) as RequestMessage)
                    : undefined;
            eventRaised = eventSentInput
                ? this.findEventRaised(this.state, eventSentInput.id)
                : undefined;
        }
        this.setProcessed([eventSent, eventRaised]);

        if (eventRaised) {
            const parsedResult = this.parseHistoryEvent(eventRaised) as ResponseMessage;

            return TaskFactory.SuccessfulTask(
                newAction,
                JSON.parse(parsedResult.result),
                eventRaised.Timestamp,
                eventSent.EventId,
                this.state.indexOf(eventRaised)
            );
        }

        // TODO: error handling

        return TaskFactory.UncompletedTask(newAction);
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
        const subOrchestratorCreated = this.findSubOrchestrationInstanceCreated(
            this.state,
            name,
            instanceId
        );
        const subOrchestratorCompleted = this.findSubOrchestrationInstanceCompleted(
            this.state,
            subOrchestratorCreated
        );
        const subOrchestratorFailed = this.findSubOrchestrationInstanceFailed(
            this.state,
            subOrchestratorCreated
        );

        this.setProcessed([
            subOrchestratorCreated,
            subOrchestratorCompleted,
            subOrchestratorFailed,
        ]);

        if (subOrchestratorCompleted) {
            const result = this.parseHistoryEvent(subOrchestratorCompleted);

            return TaskFactory.SuccessfulTask(
                newAction,
                result,
                subOrchestratorCompleted.Timestamp,
                subOrchestratorCompleted.TaskScheduledId,
                this.state.indexOf(subOrchestratorCompleted)
            );
        } else if (subOrchestratorFailed) {
            return TaskFactory.FailedTask(
                newAction,
                subOrchestratorFailed.Reason,
                subOrchestratorFailed.Timestamp,
                subOrchestratorFailed.TaskScheduledId,
                this.state.indexOf(subOrchestratorFailed),
                new DurableError(subOrchestratorFailed.Reason)
            );
        } else {
            return TaskFactory.UncompletedTask(newAction);
        }
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

        let attempt = 1;
        let subOrchestratorCreated: SubOrchestrationInstanceCreatedEvent | undefined;
        let subOrchestratorFailed: SubOrchestrationInstanceFailedEvent | undefined;
        let taskRetryTimer: TimerCreatedEvent | undefined;
        for (let i = 0; i < this.state.length; i++) {
            const historyEvent = this.state[i];
            if (historyEvent.IsProcessed) {
                continue;
            }

            if (!subOrchestratorCreated) {
                if (historyEvent.EventType === HistoryEventType.SubOrchestrationInstanceCreated) {
                    const subOrchEvent = historyEvent as SubOrchestrationInstanceCreatedEvent;
                    if (
                        subOrchEvent.Name === name &&
                        (!instanceId || instanceId === subOrchEvent.InstanceId)
                    ) {
                        subOrchestratorCreated = subOrchEvent;
                    }
                }
                continue;
            }

            if (historyEvent.EventType === HistoryEventType.SubOrchestrationInstanceCompleted) {
                if (
                    (historyEvent as SubOrchestrationInstanceCompletedEvent).TaskScheduledId ===
                    subOrchestratorCreated.EventId
                ) {
                    const subOrchCompleted = historyEvent as SubOrchestrationInstanceCompletedEvent;
                    this.setProcessed([subOrchestratorCreated, subOrchCompleted]);
                    const result = this.parseHistoryEvent(subOrchCompleted);
                    return TaskFactory.SuccessfulTask(
                        newAction,
                        result,
                        subOrchCompleted.Timestamp,
                        subOrchCompleted.TaskScheduledId,
                        i
                    );
                } else {
                    continue;
                }
            }

            if (!subOrchestratorFailed) {
                if (historyEvent.EventType === HistoryEventType.SubOrchestrationInstanceFailed) {
                    if (
                        (historyEvent as SubOrchestrationInstanceFailedEvent).TaskScheduledId ===
                        subOrchestratorCreated.EventId
                    ) {
                        subOrchestratorFailed = historyEvent as SubOrchestrationInstanceFailedEvent;
                    }
                }
                continue;
            }

            if (!taskRetryTimer) {
                if (historyEvent.EventType === HistoryEventType.TimerCreated) {
                    taskRetryTimer = historyEvent as TimerCreatedEvent;
                }
                continue;
            }

            if (historyEvent.EventType === HistoryEventType.TimerFired) {
                if ((historyEvent as TimerFiredEvent).TimerId === taskRetryTimer.EventId) {
                    const taskRetryTimerFired = historyEvent as TimerFiredEvent;
                    this.setProcessed([
                        subOrchestratorCreated,
                        subOrchestratorFailed,
                        taskRetryTimer,
                        taskRetryTimerFired,
                    ]);
                    if (attempt >= retryOptions.maxNumberOfAttempts) {
                        return TaskFactory.FailedTask(
                            newAction,
                            subOrchestratorFailed.Reason,
                            subOrchestratorFailed.Timestamp,
                            subOrchestratorFailed.TaskScheduledId,
                            i,
                            new DurableError(subOrchestratorFailed.Reason)
                        );
                    } else {
                        attempt += 1;
                        subOrchestratorCreated = undefined;
                        subOrchestratorFailed = undefined;
                        taskRetryTimer = undefined;
                    }
                } else {
                    continue;
                }
            }
        }

        return TaskFactory.UncompletedTask(newAction);
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
        tokenSource?: TokenSource
    ): Task {
        if (content && typeof content !== "string") {
            content = JSON.stringify(content);
        }

        const req = new DurableHttpRequest(method, uri, content as string, headers, tokenSource);
        const newAction = new CallHttpAction(req);

        // callHttp is internally implemented as a well-known activity function
        const httpScheduled = this.findTaskScheduled(this.state, "BuiltIn::HttpActivity");
        const httpCompleted = this.findTaskCompleted(this.state, httpScheduled);
        const httpFailed = this.findTaskFailed(this.state, httpScheduled);
        this.setProcessed([httpScheduled, httpCompleted, httpFailed]);

        if (httpCompleted) {
            const result = this.parseHistoryEvent(httpCompleted);

            return TaskFactory.SuccessfulTask(
                newAction,
                result,
                httpCompleted.Timestamp,
                httpCompleted.TaskScheduledId,
                this.state.indexOf(httpCompleted)
            );
        } else if (httpFailed) {
            return TaskFactory.FailedTask(
                newAction,
                httpFailed.Reason,
                httpFailed.Timestamp,
                httpFailed.TaskScheduledId,
                this.state.indexOf(httpFailed),
                new DurableError(httpFailed.Reason)
            );
        } else {
            return TaskFactory.UncompletedTask(newAction);
        }
    }

    /**
     * Restarts the orchestration by clearing its history.
     *
     * @param The JSON-serializable data to re-initialize the instance with.
     */
    public continueAsNew(input: unknown): Task {
        const newAction = new ContinueAsNewAction(input);

        return TaskFactory.UncompletedTask(newAction);
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
        const newAction = new CreateTimerAction(fireAt);

        const timerCreated = this.findTimerCreated(this.state, fireAt);
        const timerFired = this.findTimerFired(this.state, timerCreated);
        this.setProcessed([timerCreated, timerFired]);

        if (timerFired) {
            return TaskFactory.CompletedTimerTask(
                newAction,
                timerFired.Timestamp,
                timerFired.TimerId,
                this.state.indexOf(timerFired)
            );
        } else {
            return TaskFactory.UncompletedTimerTask(newAction);
        }
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

        const eventRaised = this.findEventRaised(this.state, name);
        this.setProcessed([eventRaised]);

        if (eventRaised) {
            const result = this.parseHistoryEvent(eventRaised);

            return TaskFactory.SuccessfulTask(
                newAction,
                result,
                eventRaised.Timestamp,
                eventRaised.EventId,
                this.state.indexOf(eventRaised)
            );
        } else {
            return TaskFactory.UncompletedTask(newAction);
        }
    }

    // ===============
    /* Returns undefined if not found. */
    private findEventRaised(state: HistoryEvent[], eventName: string): EventRaisedEvent {
        const returnValue = eventName
            ? state.filter((val: HistoryEvent) => {
                  return (
                      val.EventType === HistoryEventType.EventRaised &&
                      (val as EventRaisedEvent).Name === eventName &&
                      !val.IsProcessed
                  );
              })[0]
            : undefined;
        return returnValue as EventRaisedEvent;
    }

    /* Returns undefined if not found. */
    private findEventSent(
        state: HistoryEvent[],
        instanceId: string,
        eventName: string
    ): EventSentEvent {
        const returnValue = eventName
            ? state.filter((val: HistoryEvent) => {
                  return (
                      val.EventType === HistoryEventType.EventSent &&
                      (val as EventSentEvent).InstanceId === instanceId &&
                      (val as EventSentEvent).Name === eventName &&
                      !val.IsProcessed
                  );
              })[0]
            : undefined;
        return returnValue as EventSentEvent;
    }

    /* Returns undefined if not found. */
    private findSubOrchestrationInstanceCreated(
        state: HistoryEvent[],
        name: string,
        instanceId: string | undefined
    ): SubOrchestrationInstanceCreatedEvent | undefined {
        const matches = state.filter((val: HistoryEvent) => {
            return (
                val.EventType === HistoryEventType.SubOrchestrationInstanceCreated &&
                !val.IsProcessed
            );
        });

        if (matches.length === 0) {
            return undefined;
        }

        this.subOrchestratorCounter++;

        // Grab the first unprocessed sub orchestration creation event and verify that
        // it matches the same function name and instance id if provided. If not, we know that
        // we have nondeterministic behavior, because the callSubOrchestrator*() methods were not
        // called in the same order this replay that they were scheduled in.
        const returnValue = matches[0] as SubOrchestrationInstanceCreatedEvent;
        if (returnValue.Name !== name) {
            throw new Error(
                `The sub-orchestration call (n = ${this.subOrchestratorCounter}) should be executed with a function name of ${returnValue.Name} instead of the provided function name of ${name}. Check your code for non-deterministic behavior.`
            );
        }

        if (instanceId && returnValue.InstanceId !== instanceId) {
            throw new Error(
                `The sub-orchestration call (n = ${this.subOrchestratorCounter}) should be executed with an instance id of ${returnValue.InstanceId} instead of the provided instance id of ${instanceId}. Check your code for non-deterministic behavior.`
            );
        }
        return returnValue;
    }

    /* Returns undefined if not found. */
    private findSubOrchestrationInstanceCompleted(
        state: HistoryEvent[],
        createdSubOrch: SubOrchestrationInstanceCreatedEvent | undefined
    ): SubOrchestrationInstanceCompletedEvent | undefined {
        if (createdSubOrch === undefined) {
            return undefined;
        }

        const matches = state.filter((val: HistoryEvent) => {
            return (
                val.EventType === HistoryEventType.SubOrchestrationInstanceCompleted &&
                (val as SubOrchestrationInstanceCompletedEvent).TaskScheduledId ===
                    createdSubOrch.EventId &&
                !val.IsProcessed
            );
        });

        return matches.length > 0
            ? (matches[0] as SubOrchestrationInstanceCompletedEvent)
            : undefined;
    }

    /* Returns undefined if not found. */
    private findSubOrchestrationInstanceFailed(
        state: HistoryEvent[],
        createdSubOrchInstance: SubOrchestrationInstanceCreatedEvent | undefined
    ): SubOrchestrationInstanceFailedEvent | undefined {
        if (createdSubOrchInstance === undefined) {
            return undefined;
        }

        const matches = state.filter((val: HistoryEvent) => {
            return (
                val.EventType === HistoryEventType.SubOrchestrationInstanceFailed &&
                (val as SubOrchestrationInstanceFailedEvent).TaskScheduledId ===
                    createdSubOrchInstance.EventId &&
                !val.IsProcessed
            );
        });

        return matches.length > 0 ? (matches[0] as SubOrchestrationInstanceFailedEvent) : undefined;
    }

    /* Returns undefined if not found. */
    private findTaskScheduled(state: HistoryEvent[], name: string): TaskScheduledEvent | undefined {
        const returnValue = name
            ? (state.filter((val: HistoryEvent) => {
                  return (
                      val.EventType === HistoryEventType.TaskScheduled &&
                      (val as TaskScheduledEvent).Name === name &&
                      !val.IsProcessed
                  );
              })[0] as TaskScheduledEvent)
            : undefined;
        return returnValue;
    }

    /* Returns undefined if not found. */
    private findTaskCompleted(
        state: HistoryEvent[],
        scheduledTask: TaskScheduledEvent | undefined
    ): TaskCompletedEvent | undefined {
        if (scheduledTask === undefined) {
            return undefined;
        }

        const returnValue = scheduledTask
            ? (state.filter((val: HistoryEvent) => {
                  return (
                      val.EventType === HistoryEventType.TaskCompleted &&
                      (val as TaskCompletedEvent).TaskScheduledId === scheduledTask.EventId
                  );
              })[0] as TaskCompletedEvent)
            : undefined;
        return returnValue;
    }

    /* Returns undefined if not found. */
    private findTaskFailed(
        state: HistoryEvent[],
        scheduledTask: TaskScheduledEvent | undefined
    ): TaskFailedEvent | undefined {
        if (scheduledTask === undefined) {
            return undefined;
        }

        const returnValue = scheduledTask
            ? (state.filter((val: HistoryEvent) => {
                  return (
                      val.EventType === HistoryEventType.TaskFailed &&
                      (val as TaskFailedEvent).TaskScheduledId === scheduledTask.EventId
                  );
              })[0] as TaskFailedEvent)
            : undefined;
        return returnValue;
    }

    /* Returns undefined if not found. */
    private findTimerCreated(state: HistoryEvent[], fireAt: Date): TimerCreatedEvent {
        const returnValue = fireAt
            ? state.filter((val: HistoryEvent) => {
                  return (
                      val.EventType === HistoryEventType.TimerCreated &&
                      new Date((val as TimerCreatedEvent).FireAt).getTime() === fireAt.getTime()
                  );
              })[0]
            : undefined;
        return returnValue as TimerCreatedEvent;
    }

    /* Returns undefined if not found. */
    private findTimerFired(
        state: HistoryEvent[],
        createdTimer: TimerCreatedEvent | undefined
    ): TimerFiredEvent | undefined {
        const returnValue = createdTimer
            ? (state.filter((val: HistoryEvent) => {
                  return (
                      val.EventType === HistoryEventType.TimerFired &&
                      (val as TimerFiredEvent).TimerId === createdTimer.EventId
                  );
              })[0] as TimerFiredEvent)
            : undefined;
        return returnValue;
    }

    private setProcessed(events: Array<HistoryEvent | undefined>): void {
        events.map((val: HistoryEvent | undefined) => {
            if (val) {
                val.IsProcessed = true;
            }
        });
    }

    private parseHistoryEvent(directiveResult: HistoryEvent): unknown {
        let parsedDirectiveResult: unknown;

        switch (directiveResult.EventType) {
            case HistoryEventType.EventRaised:
                const eventRaised = directiveResult as EventRaisedEvent;
                parsedDirectiveResult =
                    eventRaised && eventRaised.Input ? JSON.parse(eventRaised.Input) : undefined;
                break;
            case HistoryEventType.SubOrchestrationInstanceCompleted:
                parsedDirectiveResult = JSON.parse(
                    (directiveResult as SubOrchestrationInstanceCompletedEvent).Result
                );
                break;
            case HistoryEventType.TaskCompleted:
                parsedDirectiveResult = JSON.parse((directiveResult as TaskCompletedEvent).Result);
                break;
            default:
                break;
        }

        return parsedDirectiveResult;
    }
}
