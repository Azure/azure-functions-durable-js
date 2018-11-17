import * as debug from "debug";
import { CallActivityAction, CallActivityWithRetryAction, CallSubOrchestratorAction,
    CallSubOrchestratorWithRetryAction, ContinueAsNewAction, CreateTimerAction, EventRaisedEvent, HistoryEvent,
    HistoryEventType, IAction, OrchestratorState, RetryOptions, SubOrchestrationInstanceCompletedEvent,
    SubOrchestrationInstanceCreatedEvent, SubOrchestrationInstanceFailedEvent, Task, TaskCompletedEvent,
    TaskFailedEvent, TaskScheduledEvent, TaskSet, TimerCreatedEvent, TimerFiredEvent, TimerTask, WaitForExternalEventAction
    } from "./classes";

const log = debug("orchestrator");

export class Orchestrator {
    private customStatus: any;

    constructor(public fn: (context: any) => IterableIterator<any>) { } // TODO: define shape of context

    public listen() {
        return this.handle.bind(this);
    }

    private async handle(context: any) {
        const state: HistoryEvent[] = context.bindings.context.history;
        const input: any = context.bindings.context.input;

        // Assign methods to context
        context.df = {};
        context.df.instanceId = context.bindings.context.instanceId;
        context.df.isReplaying = context.bindings.context.isReplaying;
        context.df.parentInstanceId = context.bindings.context.parentInstanceId;
        context.df.callActivity = this.callActivity.bind(this, state);
        context.df.callActivityWithRetry = this.callActivityWithRetry.bind(this, state);
        context.df.callSubOrchestrator = this.callSubOrchestrator.bind(this, state);
        context.df.callSubOrchestratorWithRetry = this.callSubOrchestratorWithRetry.bind(this, state);
        context.df.continueAsNew = this.continueAsNew.bind(this, state);
        context.df.createTimer = this.createTimer.bind(this, state);
        context.df.getInput = this.getInput.bind(this, input);
        context.df.setCustomStatus = this.setCustomStatus.bind(this);
        context.df.waitForExternalEvent = this.waitForExternalEvent.bind(this, state);
        context.df.Task = {};
        context.df.Task.all = this.all.bind(this, state);
        context.df.Task.any = this.any.bind(this, state);

        // Initialize currentUtcDateTime
        let decisionStartedEvent = state.find((e) => 
            (e.EventType === HistoryEventType.OrchestratorStarted));
        if (decisionStartedEvent) {
            context.df.currentUtcDateTime = decisionStartedEvent.Timestamp;
        }

        // Setup
        const gen = this.fn(context);
        const actions: IAction[][] = [];
        let partialResult: any;

        while (true) {
            try {
                const g = gen.next(partialResult ? partialResult.result : undefined);
                if (g.done) {
                    log("Iterator is done");
                    this.finish(context, state, actions, true, g.value);
                    return;
                }

                partialResult = g.value;
                if (partialResult instanceof Task && partialResult.action) {
                    actions.push([ partialResult.action ]);
                } else if (partialResult instanceof TaskSet && partialResult.actions) {
                    actions.push(partialResult.actions);
                }

                if (this.shouldFinish(partialResult)) {
                    this.finish(context, state, actions);
                    return;
                } else if (partialResult instanceof Task && partialResult.isFaulted) {
                    gen.throw(partialResult.exception);
                }

                decisionStartedEvent = state.find((e) =>
                    e.EventType === HistoryEventType.OrchestratorStarted &&
                    e.Timestamp > decisionStartedEvent.Timestamp);
                context.df.currentUtcDateTime = decisionStartedEvent.Timestamp;
            } catch (error) {
                this.error(context, actions, error);
                return;
            }
        }
    }

    private callActivity(state: HistoryEvent[], name: string, input?: any) {
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

    private callActivityWithRetry(state: HistoryEvent[], name: string, retryOptions: RetryOptions, input?: any) {
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

    private callSubOrchestrator(state: HistoryEvent[], name: string, input: any, instanceId?: string): Task {
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
        input: any,
        instanceId?: string,
    ) {
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

    private continueAsNew(state: HistoryEvent[], input: any) {
        const newAction = new ContinueAsNewAction(input);

        return new Task(
            false,
            false,
            newAction,
        );
    }

    private createTimer(state: HistoryEvent[], fireAt: Date) {
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

    private getInput(input: any) {
        return input;
    }

    private setCustomStatus(customStatusObject: any) {
        this.customStatus = customStatusObject;
    }

    private waitForExternalEvent(state: HistoryEvent[], name: string) {
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

    private all(state: HistoryEvent[], tasks: Task[]) {
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

    private any(state: any, tasks: Task[]) {
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

    private parseHistoryEvent(directiveResult: HistoryEvent) {
        let parsedDirectiveResult: any;

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

    private finish(context: any, state: HistoryEvent[], actions: IAction[][], isDone: boolean = false, output?: any) {
        log("Finish called");
        const returnValue = new OrchestratorState(isDone, actions, output, this.customStatus);

        context.done(null, returnValue);
    }

    private error(context: any, actions: IAction[][], err: Error) {
        log(`Error: ${err}`);
        const returnValue = new OrchestratorState(false, actions, undefined, this.customStatus);

        context.done(err, undefined);
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
        createdSubOrchInstance: SubOrchestrationInstanceCreatedEvent)
        : SubOrchestrationInstanceCompletedEvent {
        const returnValue = createdSubOrchInstance 
            ? state.filter((val: HistoryEvent) => {
                return val.EventType === HistoryEventType.SubOrchestrationInstanceCompleted
                    && (val as SubOrchestrationInstanceCompletedEvent).TaskScheduledId === createdSubOrchInstance.EventId;
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

    private setProcessed(events: HistoryEvent[]) {
        events.map((val: HistoryEvent) => {
            if (val) { val.IsProcessed = true; }
        });
    }

    private shouldFinish(result: any) {
        return !result.isCompleted || result instanceof Task && result.action instanceof ContinueAsNewAction;
    }
}
