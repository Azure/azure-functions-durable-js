import * as debug from "debug";
import { ActionType, CallActivityAction, CreateTimerAction, HistoryEvent, HistoryEventType,
    IAction, Task, TaskSet, TimerTask, WaitForExternalEventAction } from "./classes";

const log = debug("orchestrator");

export class Orchestrator {

    constructor(public fn: GeneratorFunction) { }

    public listen() {
        return this.handle.bind(this);
    }

    private async handle(context: any) {
        const state: HistoryEvent[] = context.bindings.context.history;
        const input: any = context.bindings.context.input;

        // Assign methods to context
        context.df = {};
        context.df.callActivityAsync = this.callActivityAsync.bind(this, state);
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
                }

                decisionStartedEvent = state.find((e) =>
                    e.EventType === HistoryEventType.OrchestratorStarted &&
                    e.Timestamp > decisionStartedEvent.Timestamp);
                context.df.currentUtcDateTime = decisionStartedEvent.Timestamp;
            } catch (error) {
                this.error(context, error);
                return;
            }
        }
    }

    private callActivityAsync(state: HistoryEvent[], name: string, input: any = "__activity__default") {
        const newAction = new CallActivityAction(name, input);

        const taskScheduled = this.findTaskScheduled(state, name);
        const taskCompleted = this.findTaskCompleted(state, taskScheduled);
        if (input && taskCompleted) {
            taskScheduled.IsProcessed = true;
            taskCompleted.IsProcessed = true;

            const result = this.parseHistoryEvent(taskCompleted);

            return new Task(true, newAction, result, taskCompleted.Timestamp, taskCompleted.TaskScheduledId);
        } else {
            return new Task(false, newAction);
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

            return new Task(true, newAction, result, eventRaised.Timestamp, eventRaised.EventId);
        } else {
            return new Task(false, newAction);
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
            case (HistoryEventType.TaskCompleted):
                parsedDirectiveResult = JSON.parse(directiveResult.Result);
                break;
            case (HistoryEventType.EventRaised):
                parsedDirectiveResult = JSON.parse(directiveResult.Input);
                break;
            default:
                break;
        }

        return parsedDirectiveResult;
    }

    private finish(context: any, state: HistoryEvent[], actions: IAction[][], isDone: boolean = false, output?: any) {
        log("Finish called");
        const returnValue = {
            isDone,
            actions,
            output,
        };

        context.done(null, returnValue);
    }

    private error(context: any, err: any) {
        log(`Error: ${err}`);

        context.done(null, { error: err });
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
