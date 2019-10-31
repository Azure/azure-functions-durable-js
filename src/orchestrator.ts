import * as debug from "debug";
import { CallActivityAction, CallActivityWithRetryAction, CallEntityAction, CallHttpAction,
    CallSubOrchestratorAction, CallSubOrchestratorWithRetryAction, ContinueAsNewAction,
    CreateTimerAction, DurableHttpRequest, DurableLock, DurableOrchestrationBindingInfo, EntityId,
    EventRaisedEvent, EventSentEvent, ExternalEventType, GuidManager, HistoryEvent, HistoryEventType,
    IAction, IOrchestrationFunctionContext, LockState, OrchestratorState, RequestMessage, ResponseMessage,
    RetryOptions, SubOrchestrationInstanceCompletedEvent, SubOrchestrationInstanceCreatedEvent,
    SubOrchestrationInstanceFailedEvent, Task, TaskCompletedEvent, TaskFailedEvent,
    TaskScheduledEvent, TaskSet, TimerCreatedEvent, TimerFiredEvent, TimerTask,
    Utils, WaitForExternalEventAction,
} from "./classes";
import { TokenSource } from "./tokensource";
import { TaskFactory } from "./task";

/** @hidden */
const log = debug("orchestrator");

/** @hidden */
export class Orchestrator {
    private currentUtcDateTime: Date;
    private customStatus: unknown;
    private newGuidCounter: number;
    private subOrchestratorCounter: number;

    constructor(public fn: (context: IOrchestrationFunctionContext) => IterableIterator<unknown>) { }

    public listen() {
        return this.handle.bind(this);
    }

    private async handle(context: IOrchestrationFunctionContext): Promise<void> {
        const orchestrationBinding = Utils.getInstancesOf<DurableOrchestrationBindingInfo>(
            context.bindings, new DurableOrchestrationBindingInfo())[0];

        if (!orchestrationBinding) {
            throw new Error("Could not finding an orchestrationClient binding on context.");
        }

        const state: HistoryEvent[] = orchestrationBinding.history;
        const input: unknown = orchestrationBinding.input;
        const instanceId: string = orchestrationBinding.instanceId;
        // const contextLocks: EntityId[] = orchestrationBinding.contextLocks;

        // Initialize currentUtcDateTime
        let decisionStartedEvent: HistoryEvent = Utils.ensureNonNull(
            state.find((e) => e.EventType === HistoryEventType.OrchestratorStarted),
            "The orchestrator can not execute without an OrchestratorStarted event.");
        this.currentUtcDateTime = new Date(decisionStartedEvent.Timestamp);

        // Reset counters
        this.newGuidCounter = 0;
        this.subOrchestratorCounter = 0;

        // Create durable orchestration context
        context.df = {
            instanceId,
            isReplaying: orchestrationBinding.isReplaying,
            parentInstanceId: orchestrationBinding.parentInstanceId,
            callActivity: this.callActivity.bind(this, state),
            callActivityWithRetry: this.callActivityWithRetry.bind(this, state),
            callEntity: this.callEntity.bind(this, state),
            callSubOrchestrator: this.callSubOrchestrator.bind(this, state),
            callSubOrchestratorWithRetry: this.callSubOrchestratorWithRetry.bind(this, state),
            callHttp: this.callHttp.bind(this, state),
            continueAsNew: this.continueAsNew.bind(this, state),
            createTimer: this.createTimer.bind(this, state),
            getInput: this.getInput.bind(this, input),
            // isLocked: this.isLocked.bind(this, contextLocks),
            // lock: this.lock.bind(this, state, instanceId, contextLocks),
            newGuid: this.newGuid.bind(this, instanceId),
            setCustomStatus: this.setCustomStatus.bind(this),
            waitForExternalEvent: this.waitForExternalEvent.bind(this, state),
            Task: {
                all: this.all.bind(this, state),
                any: this.any.bind(this, state),
            },
            currentUtcDateTime: this.currentUtcDateTime,
        };

        // Setup
        const gen = this.fn(context);
        const actions: IAction[][] = [];
        let partialResult: Task | TaskSet;

        try {
            // First execution, we have not yet "yielded" any of the tasks.
            let g = gen.next(undefined);

            while (true) {

                if (!(g.value instanceof Task || g.value instanceof TaskSet)) {
                    if (!g.done) {
                        // The orchestrator must have yielded a non-Task related type,
                        // so just return execution flow with what they yielded back.
                        g = gen.next(g.value);
                        continue;
                    } else {
                        log("Iterator is done");
                        // The customer returned an absolute type.
                        context.done(
                            null,
                            new OrchestratorState({
                                isDone: true,
                                output: g.value,
                                actions,
                                customStatus: this.customStatus,
                            }),
                        );
                        return;
                    }
                }

                partialResult = g.value as Task | TaskSet;
                if (partialResult instanceof Task && partialResult.action) {
                    if (!partialResult.wasYielded) {
                        actions.push([ partialResult.action ]);
                        partialResult.wasYielded = true;
                    }
                } else if (partialResult instanceof TaskSet && partialResult.tasks) {
                    const unyieldedTasks = partialResult.tasks.filter((task) => !task.wasYielded);
                    actions.push(unyieldedTasks.map(task => task.action));
                    unyieldedTasks.forEach(task => {
                        task.wasYielded = true;
                    });
                }

                // Return continue as new events as completed, as the execution itself is now completed.
                if (partialResult instanceof Task && partialResult.action instanceof ContinueAsNewAction) {
                    context.done(
                        null,
                        new OrchestratorState({
                            isDone: true,
                            output: undefined,
                            actions,
                            customStatus: this.customStatus,
                        }),
                    );
                    return;
                }

                if (!partialResult.isCompleted) {
                    context.done(
                        null,
                        new OrchestratorState({
                            isDone: false,
                            output: undefined,
                            actions,
                            customStatus: this.customStatus,
                        }),
                    );
                    return;
                }

                if (partialResult.isFaulted) {
                    if (!gen.throw) {
                        throw new Error("Cannot properly throw the execption returned by customer code");
                    }
                    g = gen.throw!(partialResult.exception);
                    continue;
                }

                // Handles the case where an orchestration completes with a return value of a
                // completed (non-faulted) task. This shouldn't generally happen as hopefully the customer
                // would yield the task before returning out of the generator function.
                if (g.done) {
                    log("Iterator is done");
                    context.done(null,
                        new OrchestratorState({
                            isDone: true,
                            actions,
                            output: partialResult.result,
                            customStatus: this.customStatus,
                        }),
                    );
                    return;
                }

                const newDecisionStartedEvent = state.find((e) =>
                    e.EventType === HistoryEventType.OrchestratorStarted &&
                    e.Timestamp > decisionStartedEvent.Timestamp);

                decisionStartedEvent = newDecisionStartedEvent || decisionStartedEvent;
                context.df.currentUtcDateTime = this.currentUtcDateTime = new Date(decisionStartedEvent.Timestamp);

                g = gen.next(partialResult.result);
            }
        } catch (error) {
            log(`Error: ${error}`);
            context.done(
                error,
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
                    actions,
                    error: error.stack,
                    customStatus: this.customStatus,
                }),
            );
            return;
        }
    }

    private callActivity(state: HistoryEvent[], name: string, input?: unknown): Task {
        const newAction = new CallActivityAction(name, input);

        const taskScheduled = this.findTaskScheduled(state, name);
        const taskCompleted = this.findTaskCompleted(state, taskScheduled);
        const taskFailed = this.findTaskFailed(state, taskScheduled);
        this.setProcessed([taskScheduled, taskCompleted, taskFailed]);

        if (taskCompleted) {
            const result = this.parseHistoryEvent(taskCompleted);

            return TaskFactory.SuccessfulTask(
                newAction, 
                result, 
                taskCompleted.Timestamp,
                taskCompleted.TaskScheduledId,
                state.indexOf(taskCompleted)
            );
        } else if (taskFailed) {
            return TaskFactory.FailedTask(
                newAction,
                taskFailed.Reason,
                taskFailed.Timestamp,
                taskFailed.TaskScheduledId,
                state.indexOf(taskFailed),
                new Error(taskFailed.Reason)
            );
        } else {
            return TaskFactory.UncompletedTask(
                newAction,
            );
        }
    }

    private callActivityWithRetry(
        state: HistoryEvent[],
        name: string,
        retryOptions: RetryOptions,
        input?: unknown)
        : Task {
        const newAction = new CallActivityWithRetryAction(name, retryOptions, input);

        for (let attempt = 1; attempt <= retryOptions.maxNumberOfAttempts; attempt++) {
            const taskScheduled = this.findTaskScheduled(state, name);
            const taskCompleted = this.findTaskCompleted(state, taskScheduled);
            const taskFailed = this.findTaskFailed(state, taskScheduled);
            const taskRetryTimer = this.findRetryTimer(state, taskFailed);
            const taskRetryTimerFired = this.findTimerFired(state, taskRetryTimer);
            this.setProcessed([ taskScheduled, taskCompleted, taskFailed, taskRetryTimer, taskRetryTimerFired ]);

            if (!taskScheduled) { break; }

            if (taskCompleted) {
                const result = this.parseHistoryEvent(taskCompleted);

                return new Task(true, false, newAction, result, taskCompleted.Timestamp, taskCompleted.TaskScheduledId);
            } else if (taskFailed && taskRetryTimer && attempt >= retryOptions.maxNumberOfAttempts) {
                return new Task(
                    true,
                    true,
                    newAction,
                    taskFailed.Reason,
                    taskFailed.Timestamp,
                    taskFailed.TaskScheduledId,
                    new Error(taskFailed.Reason),
                );
            }
        }

        return new Task(
            false,
            false,
            newAction,
        );
    }

    private callEntity(state: HistoryEvent[], entityId: EntityId, operationName: string, operationInput: unknown): Task {
        const newAction = new CallEntityAction(entityId, operationName, operationInput);

        const schedulerId = EntityId.getSchedulerIdFromEntityId(entityId);
        const eventSent = this.findEventSent(state, schedulerId, "op");
        let eventRaised;
        if (eventSent) {
            const eventSentInput = eventSent && eventSent.Input !== undefined ? JSON.parse(eventSent.Input) as RequestMessage : undefined;
            eventRaised = eventSentInput ? this.findEventRaised(state, eventSentInput.id) : undefined;
        }
        this.setProcessed([ eventSent, eventRaised ]);

        if (eventRaised) {
            const parsedResult = this.parseHistoryEvent(eventRaised) as ResponseMessage;

            return new Task(true, false, newAction, JSON.parse(parsedResult.result), eventRaised.Timestamp, eventSent.EventId);
        }

        // TODO: error handling

        return new Task(
            false,
            false,
            newAction,
        );
    }

    private callSubOrchestrator(state: HistoryEvent[], name: string, input?: unknown, instanceId?: string): Task {
        if (!name) {
            throw new Error("A sub-orchestration function name must be provided when attempting to create a suborchestration");
        }

        const newAction = new CallSubOrchestratorAction(name, instanceId, input);
        const subOrchestratorCreated = this.findSubOrchestrationInstanceCreated(state, name, instanceId);
        const subOrchestratorCompleted = this.findSubOrchestrationInstanceCompleted(state, subOrchestratorCreated);
        const subOrchestratorFailed = this.findSubOrchestrationInstanceFailed(state, subOrchestratorCreated);

        this.setProcessed([subOrchestratorCreated, subOrchestratorCompleted, subOrchestratorFailed]);

        if (subOrchestratorCompleted) {
            const result = this.parseHistoryEvent(subOrchestratorCompleted);

            return new Task(
                true,
                false,
                newAction,
                result,
                subOrchestratorCompleted.Timestamp,
                subOrchestratorCompleted.TaskScheduledId,
            );
        } else if (subOrchestratorFailed) {
            return new Task(
                true,
                true,
                newAction,
                subOrchestratorFailed.Reason,
                subOrchestratorFailed.Timestamp,
                subOrchestratorFailed.TaskScheduledId,
                new Error(subOrchestratorFailed.Reason),
            );
        } else {
            return new Task(
                false,
                false,
                newAction,
            );
        }
    }

    private callSubOrchestratorWithRetry(
        state: HistoryEvent[],
        name: string,
        retryOptions: RetryOptions,
        input?: unknown,
        instanceId?: string)
        : Task {
        if (!name) {
            throw new Error("A sub-orchestration function name must be provided when attempting to create a suborchestration");
        }

        const newAction = new CallSubOrchestratorWithRetryAction(name, retryOptions, input, instanceId);

        for (let attempt = 1; attempt <= retryOptions.maxNumberOfAttempts; attempt++) {
            const subOrchestratorCreated = this.findSubOrchestrationInstanceCreated(state, name, instanceId);
            const subOrchestratorCompleted = this.findSubOrchestrationInstanceCompleted(state, subOrchestratorCreated);
            const subOrchestratorFailed = this.findSubOrchestrationInstanceFailed(state, subOrchestratorCreated);
            const retryTimer = this.findRetryTimer(state, subOrchestratorFailed);
            const retryTimerFired = this.findTimerFired(state, retryTimer);
            this.setProcessed([
                subOrchestratorCreated,
                subOrchestratorCompleted,
                subOrchestratorFailed,
                retryTimer,
                retryTimerFired,
            ]);

            if (!subOrchestratorCreated) { break; }

            if (subOrchestratorCompleted) {
                const result = this.parseHistoryEvent(subOrchestratorCompleted);

                return new Task(
                    true,
                    false,
                    newAction,
                    result,
                    subOrchestratorCompleted.Timestamp,
                    subOrchestratorCompleted.TaskScheduledId,
                );
            } else if (subOrchestratorFailed && retryTimer && attempt >= retryOptions.maxNumberOfAttempts) {
                return new Task(
                    true,
                    true,
                    newAction,
                    subOrchestratorFailed.Reason,
                    subOrchestratorFailed.Timestamp,
                    subOrchestratorFailed.TaskScheduledId,
                    new Error(subOrchestratorFailed.Reason),
                );
            }
        }

        return new Task(
            false,
            false,
            newAction,
        );
    }

    private callHttp(
        state: HistoryEvent[],
        method: string,
        uri: string,
        content?: string | object,
        headers?: { [key: string]: string },
        tokenSource?: TokenSource) {
        if (content && typeof content !== "string") {
            content = JSON.stringify(content);
        }

        const req = new DurableHttpRequest(method, uri, content as string, headers, tokenSource);
        const newAction = new CallHttpAction(req);

        // callHttp is internally implemented as a well-known activity function
        const httpScheduled = this.findTaskScheduled(state, "BuiltIn::HttpActivity");
        const httpCompleted = this.findTaskCompleted(state, httpScheduled);
        const httpFailed = this.findTaskFailed(state, httpScheduled);
        this.setProcessed([httpScheduled, httpCompleted, httpFailed]);

        if (httpCompleted) {
            const result = this.parseHistoryEvent(httpCompleted);

            return new Task(true, false, newAction, result, httpCompleted.Timestamp, httpCompleted.TaskScheduledId);
        } else if (httpFailed) {
            return new Task(
                true,
                true,
                newAction,
                httpFailed.Reason,
                httpFailed.Timestamp,
                httpFailed.TaskScheduledId,
                new Error(httpFailed.Reason),
            );
        } else {
            return new Task(
                false,
                false,
                newAction,
            );
        }
    }

    private continueAsNew(state: HistoryEvent[], input: unknown): Task {
        const newAction = new ContinueAsNewAction(input);

        return new Task(
            false,
            false,
            newAction,
        );
    }

    private createTimer(state: HistoryEvent[], fireAt: Date): TimerTask {
        const newAction = new CreateTimerAction(fireAt);

        const timerCreated = this.findTimerCreated(state, fireAt);
        const timerFired = this.findTimerFired(state, timerCreated);
        this.setProcessed([ timerCreated, timerFired ]);

        if (timerFired) {
            return new TimerTask(true, false, newAction, undefined, timerFired.Timestamp, timerFired.TimerId);
        } else {
            return new TimerTask(false, false, newAction);
        }
    }

    private getInput(input: unknown): unknown {
        return input;
    }

    private isLocked(contextLocks: EntityId[]): LockState {
        return new LockState(
            contextLocks !== undefined && contextLocks !== null,
            contextLocks,
        );
    }

    private lock(state: HistoryEvent[], instanceId: string, contextLocks: EntityId[], entities: EntityId[]): DurableLock | undefined {
        if (contextLocks) {
            throw new Error("Cannot acquire more locks when already holding some locks.");
        }

        if (!entities || entities.length === 0) {
            throw new Error("The list of entities to lock must not be null or empty.");
        }

        entities = this.cleanEntities(entities);

        const lockRequestId = this.newGuid(instanceId);

        // All the entities in entities[] need to be locked, but to avoid
        // deadlock, the locks have to be acquired sequentially, in order. So,
        // we send the lock request to the first entity; when the first lock is
        // granted by the first entity, the first entity will forward the lock
        // request to the second entity, and so on; after the last entity
        // grants the last lock, a response is sent back here.

        // send lock request to first entity in the lock set

        return undefined;
    }

    private cleanEntities(entities: EntityId[]): EntityId[] {
        // sort entities
        return entities.sort((a, b) => {
            if (a.key === b.key) {
                if (a.name === b.name) {
                    return 0;
                } else if (a.name < b.name) {
                    return -1;
                } else {
                    return 1;
                }
            } else if (a.key < b.key) {
                return -1;
            } else {
                return 1;
            }
        });

        // TODO: remove duplicates if necessary
    }

    private newGuid(instanceId: string): string {
        const guidNameValue = `${instanceId}_${this.currentUtcDateTime.valueOf()}_${this.newGuidCounter}`;
        this.newGuidCounter++;
        return GuidManager.createDeterministicGuid(GuidManager.UrlNamespaceValue, guidNameValue);
    }

    private setCustomStatus(customStatusObject: unknown): void {
        this.customStatus = customStatusObject;
    }

    private waitForExternalEvent(state: HistoryEvent[], name: string): Task {
        const newAction = new WaitForExternalEventAction(name, ExternalEventType.ExternalEvent);

        const eventRaised = this.findEventRaised(state, name);
        this.setProcessed([ eventRaised ]);

        if (eventRaised) {
            const result = this.parseHistoryEvent(eventRaised);

            return new Task(true, false, newAction, result, eventRaised.Timestamp, eventRaised.EventId);
        } else {
            return new Task(false, false, newAction);
        }
    }

    private all(state: HistoryEvent[], tasks: Task[]): TaskSet {
        const allActions = tasks.reduce((accumulator, currentValue) => {
            return [...accumulator, currentValue.action];
        }, []);

        const faulted = tasks.filter((r) => r.isFaulted);
        if (faulted.length > 0) {
            return new TaskSet(true, true, tasks, undefined, faulted[0].exception);
        }

        const isCompleted = tasks.every((r) => r.isCompleted);
        if (isCompleted) {
            const results = tasks.reduce((acc, t) => {
                return [...acc, t.result];
            }, []);

            return new TaskSet(isCompleted, false, tasks, results);
        } else {
            return new TaskSet(isCompleted, false, tasks);
        }
    }

    private any(state: HistoryEvent[], tasks: Task[]): TaskSet {
        const allActions = tasks.reduce((accumulator, currentValue) => {
            return [...accumulator, currentValue.action];
        }, []);

        const completedTasks = tasks
            .filter((t) => t && t.isCompleted)
            .sort((a, b) => {
                // Because we have filtered by completed tasks, all of them should have timestamps
                if (a.timestamp && b.timestamp) {
                    if (a.timestamp > b.timestamp) { return 1; }
                    if (a.timestamp < b.timestamp) { return -1; }
                }
                return 0;
            });

        const firstCompleted = completedTasks[0];
        if (firstCompleted) {
            return new TaskSet(true, false, tasks, firstCompleted);
        } else {
            return new TaskSet(false, false, tasks);
        }
    }

    private parseHistoryEvent(directiveResult: HistoryEvent): unknown {
        let parsedDirectiveResult: unknown;

        switch (directiveResult.EventType) {
            case (HistoryEventType.EventRaised):
                const eventRaised = directiveResult as EventRaisedEvent;
                parsedDirectiveResult = (eventRaised && eventRaised.Input !== undefined) ? JSON.parse(eventRaised.Input) : undefined;
                break;
            case (HistoryEventType.SubOrchestrationInstanceCompleted):
                parsedDirectiveResult = JSON.parse((directiveResult as SubOrchestrationInstanceCompletedEvent).Result);
                break;
            case (HistoryEventType.TaskCompleted):
                parsedDirectiveResult = JSON.parse((directiveResult as TaskCompletedEvent).Result);
                break;
            default:
                break;
        }

        return parsedDirectiveResult;
    }

    /* Returns undefined if not found. */
    private findEventRaised(state: HistoryEvent[], eventName: string): EventRaisedEvent {
        const returnValue = eventName
            ? state.filter((val: HistoryEvent) => {
                return val.EventType === HistoryEventType.EventRaised
                    && (val as EventRaisedEvent).Name === eventName
                    && !val.IsProcessed;
            })[0]
            : undefined;
        return returnValue as EventRaisedEvent;
    }

    /* Returns undefined if not found. */
    private findEventSent(state: HistoryEvent[], instanceId: string, eventName: string): EventSentEvent {
        const returnValue = eventName
            ? state.filter((val: HistoryEvent) => {
                return val.EventType === HistoryEventType.EventSent
                    && (val as EventSentEvent).InstanceId === instanceId
                    && (val as EventSentEvent).Name === eventName
                    && !val.IsProcessed;
            })[0]
            : undefined;
        return returnValue as EventSentEvent;
    }

    /* Returns undefined if not found. */
    private findRetryTimer(state: HistoryEvent[], failedTask: HistoryEvent | undefined): TimerCreatedEvent | undefined {
        const returnValue = failedTask
            ? state.filter((val: HistoryEvent, index: number, array: HistoryEvent[]) => {
                const failedTaskIndex = array.indexOf(failedTask);
                return val.EventType === HistoryEventType.TimerCreated
                    && index === (failedTaskIndex + 1);
            })[0]
            : undefined;
        return returnValue as TimerCreatedEvent;
    }

    /* Returns undefined if not found. */
    private findSubOrchestrationInstanceCreated(
        state: HistoryEvent[],
        name: string,
        instanceId: string | undefined)
        : SubOrchestrationInstanceCreatedEvent | undefined {
        const matches = state.filter((val: HistoryEvent) => {
            return val.EventType === HistoryEventType.SubOrchestrationInstanceCreated
                && !val.IsProcessed;
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
            throw new Error(`The sub-orchestration call (n = ${this.subOrchestratorCounter}) should be executed with a function name of ${returnValue.Name} instead of the provided function name of ${name}. Check your code for non-deterministic behavior.`);
        }

        if (instanceId && returnValue.InstanceId !== instanceId) {
            throw new Error(`The sub-orchestration call (n = ${this.subOrchestratorCounter}) should be executed with an instance id of ${returnValue.InstanceId} instead of the provided instance id of ${instanceId}. Check your code for non-deterministic behavior.`);
        }
        return returnValue;
    }

    /* Returns undefined if not found. */
    private findSubOrchestrationInstanceCompleted(
        state: HistoryEvent[],
        createdSubOrch: SubOrchestrationInstanceCreatedEvent | undefined)
        : SubOrchestrationInstanceCompletedEvent | undefined {
        if (createdSubOrch === undefined) {
            return undefined;
        }

        const matches = state.filter((val: HistoryEvent) => {
                return val.EventType === HistoryEventType.SubOrchestrationInstanceCompleted
                    && (val as SubOrchestrationInstanceCompletedEvent).TaskScheduledId === createdSubOrch.EventId
                    && !val.IsProcessed;
            });

        return (matches.length > 0) ? matches[0] as SubOrchestrationInstanceCompletedEvent : undefined;
    }

    /* Returns undefined if not found. */
    private findSubOrchestrationInstanceFailed(
        state: HistoryEvent[],
        createdSubOrchInstance: SubOrchestrationInstanceCreatedEvent | undefined)
        : SubOrchestrationInstanceFailedEvent | undefined {
            if (createdSubOrchInstance === undefined) {
                return undefined;
            }

            const matches = state.filter((val: HistoryEvent) => {
                    return val.EventType === HistoryEventType.SubOrchestrationInstanceFailed
                        && (val as SubOrchestrationInstanceFailedEvent).TaskScheduledId === createdSubOrchInstance.EventId
                        && !val.IsProcessed;
                });

            return (matches.length > 0) ? matches[0] as SubOrchestrationInstanceFailedEvent : undefined;
    }

    /* Returns undefined if not found. */
    private findTaskScheduled(state: HistoryEvent[], name: string): TaskScheduledEvent {
        const returnValue = name
            ? state.filter((val: HistoryEvent) => {
                return val.EventType === HistoryEventType.TaskScheduled
                    && (val as TaskScheduledEvent).Name === name
                    && !val.IsProcessed;
            })[0]
            : undefined;
        return returnValue as TaskScheduledEvent;
    }

    /* Returns undefined if not found. */
    private findTaskCompleted(state: HistoryEvent[], scheduledTask: TaskScheduledEvent): TaskCompletedEvent {
        const returnValue = scheduledTask
            ? state.filter((val: HistoryEvent) => {
                return val.EventType === HistoryEventType.TaskCompleted
                    && (val as TaskCompletedEvent).TaskScheduledId === scheduledTask.EventId;
            })[0]
            : undefined;
        return returnValue as TaskCompletedEvent;
    }

    /* Returns undefined if not found. */
    private findTaskFailed(state: HistoryEvent[], scheduledTask: HistoryEvent): TaskFailedEvent {
        const returnValue = scheduledTask
        ? state.filter((val: HistoryEvent) => {
                return val.EventType === HistoryEventType.TaskFailed
                    && (val as TaskFailedEvent).TaskScheduledId === scheduledTask.EventId;
            })[0]
            : undefined;
        return returnValue as TaskFailedEvent;
    }

    /* Returns undefined if not found. */
    private findTimerCreated(state: HistoryEvent[], fireAt: Date): TimerCreatedEvent {
        const returnValue = fireAt
            ? state.filter((val: HistoryEvent) => {
                return val.EventType === HistoryEventType.TimerCreated
                    && new Date((val as TimerCreatedEvent).FireAt).getTime() === fireAt.getTime();
            })[0]
            : undefined;
        return returnValue as TimerCreatedEvent;
    }

    /* Returns undefined if not found. */
    private findTimerFired(state: HistoryEvent[], createdTimer: TimerCreatedEvent | undefined): TimerFiredEvent | undefined {
        const returnValue = createdTimer
            ? state.filter((val: HistoryEvent) => {
                return val.EventType === HistoryEventType.TimerFired
                    && (val as TimerFiredEvent).TimerId === createdTimer.EventId;
            })[0]
            : undefined;
        return returnValue as TimerFiredEvent;
    }

    private setProcessed(events: Array<HistoryEvent | undefined>): void {
        events.map((val: HistoryEvent | undefined) => {
            if (val) { val.IsProcessed = true; }
        });
    }
}
