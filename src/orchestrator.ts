import * as debug from "debug";
import { CallActivityAction, CallActivityWithRetryAction, CallSubOrchestratorAction,
    CallSubOrchestratorWithRetryAction, Constants, ContinueAsNewAction, CreateTimerAction,
    DurableOrchestrationBindingInfo, EventRaisedEvent, HistoryEvent, HistoryEventType, IAction, IFunctionContext,
    OrchestratorState, RetryOptions, SubOrchestrationInstanceCompletedEvent, SubOrchestrationInstanceCreatedEvent,
    SubOrchestrationInstanceFailedEvent, Task, TaskCompletedEvent, TaskFailedEvent, TaskScheduledEvent, TaskSet,
    TimerCreatedEvent, TimerFiredEvent, TimerTask, Utils, WaitForExternalEventAction } from "./classes";

/** @hidden */
const log = debug("orchestrator");

/** @hidden */
export class Orchestrator {
    private customStatus: unknown;

    constructor(public fn: (context: IFunctionContext) => IterableIterator<unknown>) { }

    public listen() {
        return this.handle.bind(this);
    }

    private async handle(context: IFunctionContext): Promise<void> {
        const orchestrationBinding = Utils.getInstancesOf<DurableOrchestrationBindingInfo>(
            context.bindings, new DurableOrchestrationBindingInfo())[0];

        if (!orchestrationBinding) {
            throw new Error("Could not finding an orchestrationClient binding on context.");
        }

        const state: HistoryEvent[] = orchestrationBinding.history;
        const input: unknown = orchestrationBinding.input;

        // Initialize currentUtcDateTime
        let decisionStartedEvent: HistoryEvent = state.find((e) =>
            (e.EventType === HistoryEventType.OrchestratorStarted));

        // Create durable orchestration context
        context.df = {
            instanceId: orchestrationBinding.instanceId,
            isReplaying: orchestrationBinding.isReplaying,
            parentInstanceId: orchestrationBinding.parentInstanceId,
            callActivity: this.callActivity.bind(this, state),
            callActivityWithRetry: this.callActivityWithRetry.bind(this, state),
            callSubOrchestrator: this.callSubOrchestrator.bind(this, state),
            callSubOrchestratorWithRetry: this.callSubOrchestratorWithRetry.bind(this, state),
            continueAsNew: this.continueAsNew.bind(this, state),
            createTimer: this.createTimer.bind(this, state),
            getInput: this.getInput.bind(this, input),
            setCustomStatus: this.setCustomStatus.bind(this),
            waitForExternalEvent: this.waitForExternalEvent.bind(this, state),
            Task: {
                all: this.all.bind(this, state),
                any: this.any.bind(this, state),
            },
            currentUtcDateTime: decisionStartedEvent
                ? decisionStartedEvent.Timestamp
                : undefined,
        };

        // Setup
        const gen = this.fn(context);
        const actions: IAction[][] = [];
        let partialResult: Task | TaskSet;

        try {
            let g = gen.next(partialResult ? partialResult.result : undefined);

            while (true) {
                partialResult = g.value as Task | TaskSet;
                if (partialResult instanceof Task && partialResult.action) {
                    actions.push([ partialResult.action ]);
                } else if (partialResult instanceof TaskSet && partialResult.actions) {
                    actions.push(partialResult.actions);
                }

                if (this.shouldFinish(partialResult)) {
                    context.done(
                        null,
                        new OrchestratorState({
                            isDone: false,
                            actions,
                            customStatus: this.customStatus,
                        }),
                    );
                    return;
                } else if (partialResult instanceof Task && partialResult.isFaulted) {
                    g = gen.throw(partialResult.exception);
                    continue;
                } else if (g.done) {
                    log("Iterator is done");
                    context.done(null,
                        new OrchestratorState({
                            isDone: true,
                            actions,
                            output: g.value,
                            customStatus: this.customStatus,
                        }),
                    );
                    return;
                }

                decisionStartedEvent = state.find((e) =>
                    e.EventType === HistoryEventType.OrchestratorStarted &&
                    e.Timestamp > decisionStartedEvent.Timestamp);
                context.df.currentUtcDateTime = decisionStartedEvent ? decisionStartedEvent.Timestamp : undefined;

                

                g = gen.next(partialResult ? partialResult.result : undefined);
            }
        } catch (error) {
            log(`Error: ${error}`);
            context.done(
                null,
                new OrchestratorState({
                    isDone: false,
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

            return new Task(true, false, newAction, result, taskCompleted.Timestamp, taskCompleted.TaskScheduledId);
        } else if (taskFailed) {
            return new Task(
                true,
                true,
                newAction,
                taskFailed.Reason,
                taskFailed.Timestamp,
                taskFailed.TaskScheduledId,
                new Error(taskFailed.Reason),
            );
        } else {
            return new Task(
                false,
                false,
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

    private callSubOrchestrator(state: HistoryEvent[], name: string, input?: unknown, instanceId?: string): Task {
        const newAction = new CallSubOrchestratorAction(name, instanceId, input);

        const subOrchestratorCreated = this.findSubOrchestrationInstanceCreated(state, name, instanceId);
        const subOrchestratorCompleted = this.findSubOrchestrationInstanceCompleted(state, subOrchestratorCreated);
        const subOrchestratorFailed = this.findSubOrchestrationInstanceFailed(state, subOrchestratorCreated);
        this.setProcessed([subOrchestratorCreated, subOrchestratorCompleted]);

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

    private setCustomStatus(customStatusObject: unknown): void {
        this.customStatus = customStatusObject;
    }

    private waitForExternalEvent(state: HistoryEvent[], name: string): Task {
        const newAction = new WaitForExternalEventAction(name);

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

        const isCompleted = tasks.every((r) => r.isCompleted);
        if (isCompleted) {
            const results = tasks.reduce((acc, t) => {
                return [...acc, t.result];
            }, []);

            return new TaskSet(isCompleted, allActions, results);
        } else {
            return new TaskSet(isCompleted, allActions);
        }
    }

    private any(state: HistoryEvent[], tasks: Task[]): TaskSet {
        const allActions = tasks.reduce((accumulator, currentValue) => {
            return [...accumulator, currentValue.action];
        }, []);

        const completedTasks = tasks
            .filter((t) => t.isCompleted)
            .sort((a, b) => {
                if (a.timestamp > b.timestamp) { return 1; }
                if (a.timestamp < b.timestamp) { return -1; }
                return 0;
            });

        const firstCompleted = completedTasks[0];
        if (firstCompleted) {
            return new TaskSet(true, allActions, firstCompleted);
        } else {
            return new TaskSet(false, allActions);
        }
    }

    private parseHistoryEvent(directiveResult: HistoryEvent): unknown {
        let parsedDirectiveResult: unknown;

        switch (directiveResult.EventType) {
            case (HistoryEventType.EventRaised):
                parsedDirectiveResult = JSON.parse((directiveResult as EventRaisedEvent).Input);
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
    private findRetryTimer(state: HistoryEvent[], failedTask: HistoryEvent): TimerCreatedEvent {
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
        instanceId: string)
        : SubOrchestrationInstanceCreatedEvent {
        const returnValue = name
            ? state.filter((val: HistoryEvent) => {
                return val.EventType === HistoryEventType.SubOrchestrationInstanceCreated
                    && (val as SubOrchestrationInstanceCreatedEvent).Name === name
                    && (val as SubOrchestrationInstanceCreatedEvent).InstanceId === instanceId
                    && !val.IsProcessed;
            })[0]
            : undefined;
        return returnValue as SubOrchestrationInstanceCreatedEvent;
    }

    /* Returns undefined if not found. */
    private findSubOrchestrationInstanceCompleted(
        state: HistoryEvent[],
        createdSubOrch: SubOrchestrationInstanceCreatedEvent)
        : SubOrchestrationInstanceCompletedEvent {
        const returnValue = createdSubOrch
            ? state.filter((val: HistoryEvent) => {
                return val.EventType === HistoryEventType.SubOrchestrationInstanceCompleted
                    && (val as SubOrchestrationInstanceCompletedEvent).TaskScheduledId === createdSubOrch.EventId;
            })[0]
            : undefined;
        return returnValue as SubOrchestrationInstanceCompletedEvent;
    }

    /* Returns undefined if not found. */
    private findSubOrchestrationInstanceFailed(
        state: HistoryEvent[],
        createdSubOrchInstance: SubOrchestrationInstanceCreatedEvent)
        : SubOrchestrationInstanceFailedEvent {
        const returnValue = createdSubOrchInstance
            ? state.filter((val: HistoryEvent) => {
                return val.EventType === HistoryEventType.SubOrchestrationInstanceFailed
                    && (val as SubOrchestrationInstanceFailedEvent).TaskScheduledId === createdSubOrchInstance.EventId;
            })[0]
            : undefined;
        return returnValue as SubOrchestrationInstanceFailedEvent;
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
    private findTimerFired(state: HistoryEvent[], createdTimer: HistoryEvent): TimerFiredEvent {
        const returnValue = createdTimer
            ? state.filter((val: HistoryEvent) => {
                return val.EventType === HistoryEventType.TimerFired
                    && (val as TimerFiredEvent).TimerId === createdTimer.EventId;
            })[0]
            : undefined;
        return returnValue as TimerFiredEvent;
    }

    private setProcessed(events: HistoryEvent[]): void {
        events.map((val: HistoryEvent) => {
            if (val) { val.IsProcessed = true; }
        });
    }

    private shouldFinish(result: unknown): boolean {
        return Object.prototype.hasOwnProperty.call(result, "isCompleted") && !(result as Task).isCompleted
            || result instanceof Task && result.action instanceof ContinueAsNewAction;
    }
}
