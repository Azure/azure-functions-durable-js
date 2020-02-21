import * as debug from "debug";
import { AggregatedError } from "./aggregatederror";
import { CallActivityAction, CallActivityWithRetryAction, CallEntityAction, CallHttpAction,
    CallSubOrchestratorAction, CallSubOrchestratorWithRetryAction, ContinueAsNewAction,
    CreateTimerAction, DurableHttpRequest, DurableLock, DurableOrchestrationBindingInfo, EntityId,
    EventRaisedEvent, EventSentEvent, ExternalEventType, GuidManager, HistoryEvent, HistoryEventType,
    IAction, IOrchestrationFunctionContext, LockState, OrchestratorState, RequestMessage, ResponseMessage,
    RetryOptions, SubOrchestrationInstanceCompletedEvent, SubOrchestrationInstanceCreatedEvent,
    SubOrchestrationInstanceFailedEvent, Task, TaskCompletedEvent, TaskFactory, TaskFailedEvent, TaskFilter,
    TaskScheduledEvent, TaskSet, TimerCreatedEvent, TimerFiredEvent, TimerTask,
    Utils, WaitForExternalEventAction,
} from "./classes";
import { DurableError } from "./durableerror";
import { OrchestrationFailureError } from "./orchestrationfailureerror";
import { CompletedTask, TaskBase } from "./tasks/taskinterfaces";
import { TokenSource } from "./tokensource";

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
        let partialResult: TaskBase;

        try {
            // First execution, we have not yet "yielded" any of the tasks.
            let g = gen.next(undefined);

            while (true) {

                if (!(TaskFilter.isYieldable(g.value))) {
                    if (!g.done) {
                        // The orchestrator must have yielded a non-Task related type,
                        // so just return execution flow with what they yielded back.
                        g = gen.next(g.value);
                        continue;
                    } else {
                        log("Iterator is done");
                        // The customer returned an absolute type.
                        context.done(
                            undefined,
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

                partialResult = g.value as TaskBase;
                const newActions = partialResult.yieldNewActions();
                if (newActions && newActions.length > 0) {
                    actions.push(newActions);
                }

                // Return continue as new events as completed, as the execution itself is now completed.
                if (TaskFilter.isSingleTask(partialResult) && partialResult.action instanceof ContinueAsNewAction) {
                    context.done(
                        undefined,
                        new OrchestratorState({
                            isDone: true,
                            output: undefined,
                            actions,
                            customStatus: this.customStatus,
                        }),
                    );
                    return;
                }

                if (!TaskFilter.isCompletedTask(partialResult)) {
                    context.done(
                        undefined,
                        new OrchestratorState({
                            isDone: false,
                            output: undefined,
                            actions,
                            customStatus: this.customStatus,
                        }),
                    );
                    return;
                }

                // The first time a task is marked as complete, the history event that finally marked the task as completed
                // should not yet have been played by the Durable Task framework, resulting in isReplaying being false.
                // On replays, the event will have already been processed by the framework, and IsPlayed will be marked as true.
                if (state[partialResult.completionIndex] !== undefined) {
                  context.df.isReplaying = state[partialResult.completionIndex].IsPlayed;
                }

                if (TaskFilter.isFailedTask(partialResult)) {
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
                    context.done(undefined,
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
            // Wrap orchestration state in OutOfProcErrorWrapper to ensure data
            // gets embedded in error message received by C# extension.
            const errorState = new OrchestratorState({
                isDone: false,
                output: undefined,
                actions,
                error: error.message,
                customStatus: this.customStatus,
            });
            context.done(new OrchestrationFailureError(error, errorState), undefined);
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
                state.indexOf(taskCompleted),
            );
        } else if (taskFailed) {
            return TaskFactory.FailedTask(
                newAction,
                taskFailed.Reason,
                taskFailed.Timestamp,
                taskFailed.TaskScheduledId,
                state.indexOf(taskFailed),
                new DurableError(taskFailed.Reason),
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

                return TaskFactory.SuccessfulTask(newAction, result, taskCompleted.Timestamp, taskCompleted.TaskScheduledId, state.indexOf(taskCompleted));
            } else if (taskFailed
                && taskRetryTimer
                && attempt >= retryOptions.maxNumberOfAttempts) {
                return TaskFactory.FailedTask(
                    newAction,
                    taskFailed.Reason,
                    taskFailed.Timestamp,
                    taskFailed.TaskScheduledId,
                    state.indexOf(taskFailed),
                    new DurableError(taskFailed.Reason),
                );
            }
        }

        return TaskFactory.UncompletedTask(newAction);
    }

    private callEntity(state: HistoryEvent[], entityId: EntityId, operationName: string, operationInput: unknown): Task {
        const newAction = new CallEntityAction(entityId, operationName, operationInput);

        const schedulerId = EntityId.getSchedulerIdFromEntityId(entityId);
        const eventSent = this.findEventSent(state, schedulerId, "op");
        let eventRaised;
        if (eventSent) {
            const eventSentInput = eventSent && eventSent.Input ? JSON.parse(eventSent.Input) as RequestMessage : undefined;
            eventRaised = eventSentInput ? this.findEventRaised(state, eventSentInput.id) : undefined;
        }
        this.setProcessed([ eventSent, eventRaised ]);

        if (eventRaised) {
            const parsedResult = this.parseHistoryEvent(eventRaised) as ResponseMessage;

            return TaskFactory.SuccessfulTask(newAction, JSON.parse(parsedResult.result), eventRaised.Timestamp, eventSent.EventId, state.indexOf(eventRaised));
        }

        // TODO: error handling

        return TaskFactory.UncompletedTask(
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

            return TaskFactory.SuccessfulTask(
                newAction,
                result,
                subOrchestratorCompleted.Timestamp,
                subOrchestratorCompleted.TaskScheduledId,
                state.indexOf(subOrchestratorCompleted),
            );
        } else if (subOrchestratorFailed) {
            return TaskFactory.FailedTask(
                newAction,
                subOrchestratorFailed.Reason,
                subOrchestratorFailed.Timestamp,
                subOrchestratorFailed.TaskScheduledId,
                state.indexOf(subOrchestratorFailed),
                new DurableError(subOrchestratorFailed.Reason),
            );
        } else {
            return TaskFactory.UncompletedTask(
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

                return TaskFactory.SuccessfulTask(
                    newAction,
                    result,
                    subOrchestratorCompleted.Timestamp,
                    subOrchestratorCompleted.TaskScheduledId,
                    state.indexOf(subOrchestratorCompleted),
                );
            } else if (subOrchestratorFailed
                && retryTimer
                && attempt >= retryOptions.maxNumberOfAttempts) {
                return TaskFactory.FailedTask(
                    newAction,
                    subOrchestratorFailed.Reason,
                    subOrchestratorFailed.Timestamp,
                    subOrchestratorFailed.TaskScheduledId,
                    state.indexOf(subOrchestratorFailed),
                    new DurableError(subOrchestratorFailed.Reason),
                );
            }
        }

        return TaskFactory.UncompletedTask(
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

            return TaskFactory.SuccessfulTask(
                newAction,
                result,
                httpCompleted.Timestamp,
                httpCompleted.TaskScheduledId,
                state.indexOf(httpCompleted),
            );
        } else if (httpFailed) {
            return TaskFactory.FailedTask(
                newAction,
                httpFailed.Reason,
                httpFailed.Timestamp,
                httpFailed.TaskScheduledId,
                state.indexOf(httpFailed),
                new DurableError(httpFailed.Reason),
            );
        } else {
            return TaskFactory.UncompletedTask(
                newAction,
            );
        }
    }

    private continueAsNew(state: HistoryEvent[], input: unknown): Task {
        const newAction = new ContinueAsNewAction(input);

        return TaskFactory.UncompletedTask(
            newAction,
        );
    }

    private createTimer(state: HistoryEvent[], fireAt: Date): TimerTask {
        const newAction = new CreateTimerAction(fireAt);

        const timerCreated = this.findTimerCreated(state, fireAt);
        const timerFired = this.findTimerFired(state, timerCreated);
        this.setProcessed([ timerCreated, timerFired ]);

        if (timerFired) {
            return TaskFactory.CompletedTimerTask(newAction, timerFired.Timestamp, timerFired.TimerId, state.indexOf(timerFired));
        } else {
            return TaskFactory.UncompletedTimerTask(newAction);
        }
    }

    private getInput(input: unknown): unknown {
        return input;
    }

    private isLocked(contextLocks: EntityId[]): LockState {
        return new LockState(
            contextLocks && contextLocks !== null,
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

            return TaskFactory.SuccessfulTask(
                newAction,
                result,
                eventRaised.Timestamp,
                eventRaised.EventId,
                state.indexOf(eventRaised));
        } else {
            return TaskFactory.UncompletedTask(newAction);
        }
    }

    private all(state: HistoryEvent[], tasks: TaskBase[]): TaskSet {
        let maxCompletionIndex: number | undefined;
        const errors: Error[] = [];
        const results: Array<unknown> = [];
        for (let index = 0; index < tasks.length; index++) {
            const task = tasks[index];
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
            return TaskFactory.FailedTaskSet(tasks, completionIndex, new AggregatedError(errors));
        } else {
            return TaskFactory.SuccessfulTaskSet(tasks, completionIndex, results);
        }
    }

    private any(state: HistoryEvent[], tasks: TaskBase[]): TaskSet {
        if (!tasks || tasks.length === 0) {
            throw new Error("At least one yieldable task must be provided to wait for.");
        }

        let firstCompleted: CompletedTask | undefined;
        for (let index = 0; index < tasks.length; index++) {
            const task = tasks[index];
            if (TaskFilter.isCompletedTask(task)) {
                if (!firstCompleted) {
                    firstCompleted = task;
                } else if (task.completionIndex < firstCompleted.completionIndex) {
                    firstCompleted = task;
                }
            }
        }

        if (firstCompleted) {
            return TaskFactory.SuccessfulTaskSet(tasks, firstCompleted.completionIndex, firstCompleted);
        } else {
            return TaskFactory.UncompletedTaskSet(tasks);
        }
    }

    private parseHistoryEvent(directiveResult: HistoryEvent): unknown {
        let parsedDirectiveResult: unknown;

        switch (directiveResult.EventType) {
            case (HistoryEventType.EventRaised):
                const eventRaised = directiveResult as EventRaisedEvent;
                parsedDirectiveResult = (eventRaised && eventRaised.Input)
                    ? JSON.parse(eventRaised.Input) : undefined;
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
    private findTaskScheduled(state: HistoryEvent[], name: string): TaskScheduledEvent | undefined {
        const returnValue = name
            ? state.filter((val: HistoryEvent) => {
                return val.EventType === HistoryEventType.TaskScheduled
                    && (val as TaskScheduledEvent).Name === name
                    && !val.IsProcessed;
            })[0] as TaskScheduledEvent
            : undefined;
        return returnValue;
    }

    /* Returns undefined if not found. */
    private findTaskCompleted(state: HistoryEvent[], scheduledTask: TaskScheduledEvent | undefined): TaskCompletedEvent | undefined {
        if (scheduledTask === undefined) {
            return undefined;
        }

        const returnValue = scheduledTask
            ? state.filter((val: HistoryEvent) => {
                return val.EventType === HistoryEventType.TaskCompleted
                    && (val as TaskCompletedEvent).TaskScheduledId === scheduledTask.EventId;
            })[0] as TaskCompletedEvent
            : undefined;
        return returnValue;
    }

    /* Returns undefined if not found. */
    private findTaskFailed(state: HistoryEvent[], scheduledTask: TaskScheduledEvent | undefined): TaskFailedEvent | undefined {
        if (scheduledTask === undefined) {
            return undefined;
        }

        const returnValue = scheduledTask
        ? state.filter((val: HistoryEvent) => {
                return val.EventType === HistoryEventType.TaskFailed
                    && (val as TaskFailedEvent).TaskScheduledId === scheduledTask.EventId;
            })[0] as TaskFailedEvent
            : undefined;
        return returnValue;
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
            })[0] as TimerFiredEvent
            : undefined;
        return returnValue;
    }

    private setProcessed(events: Array<HistoryEvent | undefined>): void {
        events.map((val: HistoryEvent | undefined) => {
            if (val) { val.IsProcessed = true; }
        });
    }
}
