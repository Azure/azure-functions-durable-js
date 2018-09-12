import * as debug from "debug";
import { ActionType, CallActivityAction, CallSubOrchestratorAction, CreateTimerAction,
    HistoryEvent, HistoryEventType, IAction, Task, TaskSet, TimerTask,
    WaitForExternalEventAction } from "./classes";
import { OrchestratorState } from "./orchestratorstate";

const log = debug("orchestrator");

export class Orchestrator {

    constructor(public fn: (context: any) => IterableIterator<any>) { }

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
        context.df.callActivity = this.callActivity.bind(this, state);
        context.df.callSubOrchestrator = this.callSubOrchestrator.bind(this, state);
        context.df.createTimer = this.createTimer.bind(this, state);
        context.df.getInput = this.getInput.bind(this, input);
        context.df.waitForExternalEvent = this.waitForExternalEvent.bind(this, state);
        context.df.Task = {};
        context.df.Task.all = this.all.bind(this, state);
        context.df.Task.any = this.any.bind(this, state);

        // Initialize currentUtcDateTime
        let decisionStartedEvent = state.find((e) => (e.EventType === HistoryEventType.OrchestratorStarted));
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

                if (!partialResult.isCompleted) {
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
        if (taskCompleted) {
            taskScheduled.IsProcessed = true;
            taskCompleted.IsProcessed = true;

            const result = this.parseHistoryEvent(taskCompleted);

            return new Task(true, false, newAction, result, taskCompleted.Timestamp, taskCompleted.TaskScheduledId);
        } else if (taskFailed) {
            taskScheduled.IsProcessed = true;
            taskFailed.IsProcessed = true;

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

    private callSubOrchestrator(state: HistoryEvent[], name: string, input: any, instanceId?: string): Task {
        const newAction = new CallSubOrchestratorAction(name, instanceId, input);

        const subOrchestratorCreated = this.findSubOrchestrationInstanceCreated(state, name, instanceId);
        const subOrchestratorCompleted = this.findSubOrchestrationInstanceCompleted(state, subOrchestratorCreated);

        if (subOrchestratorCompleted) {
            subOrchestratorCreated.IsProcessed = true;
            subOrchestratorCompleted.IsProcessed = true;

            const result = this.parseHistoryEvent(subOrchestratorCompleted);

            return new Task(
                true,
                false,
                newAction,
                result,
                subOrchestratorCompleted.Timestamp,
                subOrchestratorCompleted.TaskScheduledId,
            );
        } else {
            return new Task(
                false,
                false,
                newAction,
            );
        }
    }

    private createTimer(state: HistoryEvent[], fireAt: Date) {
        const newAction = new CreateTimerAction(fireAt);

        const timerCreated = this.findTimerCreated(state, fireAt);
        const timerFired = this.findTimerFired(state, timerCreated);
        if (timerFired) {
            timerCreated.IsProcessed = true;
            timerFired.IsProcessed = true;

            return new TimerTask(true, false, newAction, undefined, timerFired.Timestamp, timerFired.TimerId);
        } else {
            return new TimerTask(false, false, newAction);
        }
    }

    private getInput(input: any) {
        return input;
    }

    private waitForExternalEvent(state: HistoryEvent[], name: string) {
        const newAction = new WaitForExternalEventAction(name);

        const eventRaised = this.findEventRaised(state, name);
        if (eventRaised) {
            eventRaised.IsProcessed = true;

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
                parsedDirectiveResult = JSON.parse(directiveResult.Input);
                break;
            case (HistoryEventType.SubOrchestrationInstanceCompleted):
                parsedDirectiveResult = JSON.parse(directiveResult.Result);
                break;
            case (HistoryEventType.TaskCompleted):
                parsedDirectiveResult = JSON.parse(directiveResult.Result);
                break;
            default:
                break;
        }

        return parsedDirectiveResult;
    }

    private finish(context: any, state: HistoryEvent[], actions: IAction[][], isDone: boolean = false, output?: any) {
        log("Finish called");
        const returnValue = new OrchestratorState(isDone, actions, output);

        context.done(null, returnValue);
    }

    private error(context: any, actions: IAction[][], err: Error) {
        log(`Error: ${err}`);
        const returnValue = new OrchestratorState(false, actions, undefined);

        context.done(err, undefined);
    }

    /* Returns undefined if not found. */
    private findEventRaised(state: HistoryEvent[], eventName: string) {
        return eventName ?
            state.filter((val: HistoryEvent) => {
                return val.EventType === HistoryEventType.EventRaised
                    && val.Name === eventName
                    && !val.IsProcessed;
            })[0]
            : undefined;
    }

    /* Returns undefined if not found. */
    private findSubOrchestrationInstanceCreated(state: HistoryEvent[], name: string, instanceId: string) {
        return name ?
            state.filter((val: HistoryEvent) => {
                return val.EventType === HistoryEventType.SubOrchestrationInstanceCreated
                    && val.Name === name
                    && val.InstanceId === instanceId
                    && !val.IsProcessed;
            })[0]
            : undefined;
    }

    /* Returns undefined if not found. */
    private findSubOrchestrationInstanceCompleted(state: HistoryEvent[], createdSubOrchInstance: HistoryEvent) {
        return createdSubOrchInstance ?
            state.filter((val: HistoryEvent) => {
                return val.EventType === HistoryEventType.SubOrchestrationInstanceCompleted
                    && val.TaskScheduledId === createdSubOrchInstance.EventId;
            })[0]
            : undefined;
    }

    /* Returns undefined if not found. */
    private findTaskScheduled(state: HistoryEvent[], name: string) {
        return name ?
            state.filter((val: HistoryEvent) => {
                return val.EventType === HistoryEventType.TaskScheduled
                    && val.Name === name
                    && !val.IsProcessed;
            })[0]
            : undefined;
    }

    /* Returns undefined if not found. */
    private findTaskCompleted(state: HistoryEvent[], scheduledTask: HistoryEvent) {
        return scheduledTask ?
            state.filter((val: HistoryEvent) => {
                return val.EventType === HistoryEventType.TaskCompleted
                    && val.TaskScheduledId === scheduledTask.EventId;
            })[0]
            : undefined;
    }

    /* Returns undefined if not found. */
    private findTaskFailed(state: HistoryEvent[], scheduledTask: HistoryEvent) {
        return scheduledTask ?
            state.filter((val: HistoryEvent) => {
                return val.EventType === HistoryEventType.TaskFailed
                    && val.TaskScheduledId === scheduledTask.EventId;
            })[0]
            : undefined;
    }

    /* Returns undefined if not found. */
    private findTimerCreated(state: HistoryEvent[], fireAt: Date) {
        return fireAt ?
            state.filter((val: HistoryEvent) => {
                return val.EventType === HistoryEventType.TimerCreated
                    && new Date(val.FireAt).getTime() === fireAt.getTime();
            })[0]
            : undefined;
    }

    /* Returns undefined if not found. */
    private findTimerFired(state: HistoryEvent[], createdTimer: HistoryEvent) {
        return createdTimer ?
            state.filter((val: HistoryEvent) => {
                return val.EventType === HistoryEventType.TimerFired
                    && val.TimerId === createdTimer.EventId;
            })[0]
            : undefined;
    }
}
