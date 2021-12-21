import { RetryOptions } from ".";
import { WhenAllAction } from "./actions/whenallaction";
import { WhenAnyAction } from "./actions/whenanyaction";
import {
    CallEntityAction,
    CreateTimerAction,
    DurableOrchestrationContext,
    EventRaisedEvent,
    EventSentEvent,
    HistoryEvent,
    HistoryEventType,
    IAction,
    IOrchestrationFunctionContext,
    RequestMessage,
    ResponseMessage,
    SubOrchestrationInstanceCompletedEvent,
    Task,
    TaskCompletedEvent,
} from "./classes";
import { OrchestrationFailureError } from "./orchestrationfailureerror";
import { OrchestratorState } from "./orchestratorstate";
import { UpperSchemaVersion } from "./upperSchemaVersion";

export enum ReplaySchema {
    V1,
    V2,
}

enum TaskState {
    Running,
    Failed,
    Completed,
}

export type TaskID = number | "unassigned" | "ignorable" | string;
export type BackingAction = IAction | "bookeepingOnly";

export abstract class TaskBase {
    public state: TaskState;
    public parent: CompoundTask | undefined;
    public isPlayed: boolean;
    public result: unknown;

    constructor(public id: TaskID, protected action: BackingAction) {
        this.state = TaskState.Running;
    }

    get actionObj(): BackingAction {
        return this.action;
    }

    get stateObj(): TaskState {
        return this.state;
    }

    get isCompleted(): boolean {
        return this.state !== TaskState.Running;
    }

    private changeState(state: TaskState): void {
        if (state === TaskState.Running) {
            throw Error("Cannot change Task to the RUNNING state.");
        }
        this.state = state;
    }

    public SetValue(isError: boolean, value: unknown): void {
        let newState: TaskState;

        if (isError) {
            if (value instanceof Error) {
                if (value instanceof TaskBase && value.result instanceof Error) {
                    const errMessage = `Task ID ${this.id} failed but it's value was not an Exception`;
                    throw new Error(errMessage);
                }
            }
            newState = TaskState.Failed;
        } else {
            newState = TaskState.Completed;
        }

        this.changeState(newState);
        this.result = value;
        this.propagate();
    }

    private propagate(): void {
        const hasCompleted = this.state !== TaskState.Running;
        if (hasCompleted && this.parent !== undefined) {
            this.parent.handleCompletion(this);
        }
    }
}

export class InternalOnlyTask extends TaskBase {
    constructor() {
        super("unassigned", "bookeepingOnly");
    }
}

export class ProperTask extends TaskBase {
    protected action: IAction;

    get actionObj(): IAction {
        return this.action;
    }
}

export abstract class CompoundTask extends ProperTask {
    protected firstError: Error | undefined;

    constructor(public children: TaskBase[], protected action: IAction) {
        super("ignorable", action);
        children.map((c) => (c.parent = this));
        this.firstError = undefined;

        if (children.length == 0) {
            this.state = TaskState.Completed;
        }
    }

    public handleCompletion(child: TaskBase): void {
        if (!this.isPlayed) {
            this.isPlayed = child.isPlayed;
        }
        this.trySetValue(child);
    }

    abstract trySetValue(child: TaskBase): void;
}

export class AtomicTask extends ProperTask {}

export class TimerTask extends AtomicTask {
    constructor(public id: TaskID, public action: CreateTimerAction) {
        super(id, action);
    }

    get isCancelled(): boolean {
        return this.action.isCanceled;
    }

    public cancel(): void {
        if (this.isCompleted) {
            throw Error("Cannot cancel a completed task.");
        }
        this.action.isCanceled = true; // TODO: this is a typo :)
    }
}

export class WhenAllTask extends CompoundTask {
    constructor(public children: TaskBase[], protected action: IAction) {
        super(children, action);
    }

    public trySetValue(child: AtomicTask): void {
        if (child.stateObj === TaskState.Completed) {
            if (this.children.every((c) => c.stateObj === TaskState.Completed)) {
                const results = this.children.map((c) => c.result);
                this.SetValue(false, results);
            }
        } else {
            if (this.firstError === undefined) {
                this.firstError = child.result as Error;
                this.SetValue(true, this.firstError);
            }
        }
    }
}

export class WhenAnyTask extends CompoundTask {
    public trySetValue(child: TaskBase): void {
        if (this.state === TaskState.Running) {
            this.SetValue(false, child);
        }
    }
}

export class RetryAbleTask extends WhenAllTask {
    private isWaitingOnTimer: boolean;
    private numAttempts: number;
    private error: any;

    constructor(
        public innerTask: ProperTask,
        private retryOptions: RetryOptions,
        private executor: TaskOrchestrationExecutor
    ) {
        super([innerTask], innerTask.actionObj);
        this.numAttempts = 1;
        this.isWaitingOnTimer = false;
    }

    public trySetValue(child: TaskBase): void {
        if (this.isWaitingOnTimer) {
            this.isWaitingOnTimer = false;

            if (this.numAttempts >= this.retryOptions.maxNumberOfAttempts) {
                // we have reached the max number of attempts, set error
                this.SetValue(true, this.error);
            } else {
                // re-schedule tasks
                const rescheduledTask = new InternalOnlyTask();
                rescheduledTask.parent = this;
                this.children.push(rescheduledTask);
                this.executor.addToOpenTasks(rescheduledTask);
                this.numAttempts++;
            }
        } else if (child.stateObj === TaskState.Completed) {
            // task succeeded
            this.SetValue(false, child.result);
        } else {
            // task failed, schedule timer to retry again
            const rescheduledTask = new InternalOnlyTask();
            rescheduledTask.parent = this;
            this.children.push(rescheduledTask);
            this.executor.addToOpenTasks(rescheduledTask);
            this.isWaitingOnTimer = true;
            this.error = child.result;
        }
    }
}

export class TaskOrchestrationExecutor {
    private context: DurableOrchestrationContext;
    private currentTask: TaskBase;
    private output: unknown;
    private exception: Error | undefined;
    private orchestratorReturned: boolean;
    private generator: Generator<TaskBase, any, any>;
    private deferredTasks: Record<number | string, () => void>;
    private sequenceNumber: number;
    private schemaVersion: UpperSchemaVersion;
    public willContinueAsNew: boolean;
    private actions: IAction[];
    protected openTasks: Record<number | string, TaskBase | TaskBase[]>;
    private eventToTaskValuePayload: { [key in HistoryEventType]?: [boolean, string] };

    constructor() {
        this.eventToTaskValuePayload = {
            [HistoryEventType.TaskCompleted]: [true, "TaskScheduledId"],
            [HistoryEventType.TimerFired]: [true, "TimerId"],
            [HistoryEventType.SubOrchestrationInstanceCompleted]: [true, "TaskScheduledId"],
            [HistoryEventType.EventRaised]: [true, "Name"],
            [HistoryEventType.TaskFailed]: [false, "TaskScheduledId"],
            [HistoryEventType.SubOrchestrationInstanceFailed]: [false, "TaskScheduledId"],
        };
        this.initialize();
    }

    private initialize(): void {
        this.sequenceNumber = 0;
        this.currentTask = new InternalOnlyTask();
        this.currentTask.SetValue(false, undefined);
        this.willContinueAsNew = false;
        this.openTasks = {};
        this.actions = [];
        this.deferredTasks = {};

        this.output = undefined;
        this.exception = undefined;
        this.orchestratorReturned = false;
    }

    public async execute(
        context: IOrchestrationFunctionContext,
        history: HistoryEvent[],
        schemaVersion: UpperSchemaVersion,
        fn: (context: IOrchestrationFunctionContext) => IterableIterator<unknown>
    ): Promise<void> {
        this.schemaVersion = schemaVersion;
        this.context = context.df;
        this.generator = fn(context) as Generator<TaskBase, any, any>; // what happens if code is not a generator?

        for (const historyEvent of history) {
            this.processEvent(historyEvent);
            if (this.hasExecutionCompleted()) {
                break;
            }
        }

        /* if (!this.willContinueAsNew) {
            this.orchestratorReturned = true;
            this.output = this.output;
        }*/

        const actions: IAction[][] = this.actions.length == 0 ? [] : [this.actions];
        const orchestratorState = new OrchestratorState({
            isDone: this.orchestrationInvocationCompleted(),
            actions: actions,
            output: this.output,
            error: this.exception?.message,
            customStatus: this.context.customStatus,
            schemaVersion: this.schemaVersion,
        });

        let error = undefined;
        let result: any = orchestratorState;
        if (this.exception !== undefined) {
            error = new OrchestrationFailureError(this.orchestratorReturned, orchestratorState);
            result = undefined;
        }
        context.done(error, result);
        return;
    }

    private hasExecutionCompleted(): boolean {
        return this.orchestrationInvocationCompleted() || this.exception !== undefined;
    }

    private orchestrationInvocationCompleted(): boolean {
        return this.orchestratorReturned || this.willContinueAsNew;
    }

    private processEvent(event: HistoryEvent): void {
        function processSpecialEventsClosure(event: HistoryEvent): boolean {
            switch (eventType) {
                case HistoryEventType.OrchestratorStarted: {
                    const timestamp = event.Timestamp;
                    if (timestamp > this.context.currentUtcDateTime) {
                        this.context.currentUtcDateTime = timestamp;
                    }
                    return true;
                }
                case HistoryEventType.ContinueAsNew: {
                    this.initialize();
                    return true;
                }
                case HistoryEventType.ExecutionStarted: {
                    this.resumeUserCode();
                    return true;
                }
                case HistoryEventType.EventSent: {
                    const key = event.EventId;
                    if (
                        Object.keys(this.openTasks).findIndex(
                            (k) => ((k as unknown) as Number) === key
                        )
                    ) {
                        const task = this.openTasks[key] as ProperTask;
                        const action = task.actionObj;
                        if (action instanceof CallEntityAction) {
                            // review all of this :)
                            const eventSent = event as EventSentEvent;
                            const requestMessage = JSON.parse(
                                eventSent.Input as string
                            ) as RequestMessage;
                            const eventId = requestMessage.id;
                            delete this.openTasks[key]; // TODO: make sure this works
                            this.openTasks[eventId] = task;
                        }
                    }
                    return true;
                }
            }
            return false;
        }

        const processSpecialEvents = processSpecialEventsClosure.bind(this);

        const eventType = event.EventType;
        const wasProcessed = processSpecialEvents(event);
        if (!wasProcessed) {
            if (Object.keys(this.eventToTaskValuePayload).find((k) => k === eventType.toString())) {
                const [isSuccess, idKey] = this.eventToTaskValuePayload[eventType] as [
                    boolean,
                    string
                ];
                this.setTaskValue(event, isSuccess, idKey);
                this.resumeUserCode();
            }
        }
    }

    private setTaskValue(event: HistoryEvent, isSuccess: boolean, idKey: string): void {
        function parseHistoryEvent(directiveResult: HistoryEvent): unknown {
            let parsedDirectiveResult: unknown;

            switch (directiveResult.EventType) {
                case HistoryEventType.SubOrchestrationInstanceCompleted:
                    parsedDirectiveResult = JSON.parse(
                        (directiveResult as SubOrchestrationInstanceCompletedEvent).Result
                    );
                    break;
                case HistoryEventType.TaskCompleted:
                    parsedDirectiveResult = JSON.parse(
                        (directiveResult as TaskCompletedEvent).Result
                    );
                    break;
                case HistoryEventType.EventRaised:
                    const eventRaised = directiveResult as EventRaisedEvent;
                    parsedDirectiveResult =
                        eventRaised && eventRaised.Input
                            ? JSON.parse(eventRaised.Input)
                            : undefined;
                    break;
                default:
                    break;
            }
            return parsedDirectiveResult;
        }

        let task: TaskBase;

        const key = event[idKey as keyof typeof event] as number; // TODO: a bit of magic here
        const taskOrtaskList = this.openTasks[key];
        delete this.openTasks[key];
        if (taskOrtaskList === undefined) {
            const updateTask = function (): void {
                this.setTaskValue(event, isSuccess, idKey);
                return;
            };
            this.deferredTasks[key] = updateTask.bind(this);
            return;
        } else if (taskOrtaskList instanceof TaskBase) {
            task = taskOrtaskList;
        } else {
            const taskList = taskOrtaskList;
            task = taskList.pop() as TaskBase; //ensure the pop is in-place
            if (taskList.length > 0) {
                this.openTasks[key] = taskList;
            }
        }

        let newValue: unknown;
        if (isSuccess) {
            newValue = parseHistoryEvent(event);
            const action = task.actionObj;
            if (action instanceof CallEntityAction) {
                const eventPayload: ResponseMessage = newValue as ResponseMessage;
                newValue = JSON.parse(eventPayload.result);

                if (eventPayload.exceptionType !== undefined) {
                    newValue = Error(newValue as string);
                    isSuccess = false;
                }
            }
        } else {
            if (
                this.typeSafeHasOwnProperty(event, "Reason") &&
                this.typeSafeHasOwnProperty(event, "Details")
            ) {
                newValue = new Error(`${event.Reason} \n ${event.Details}`);
            }
        }
        task.isPlayed = event.IsPlayed;
        task.SetValue(!isSuccess, newValue);
    }

    private typeSafeHasOwnProperty<X extends {}, Y extends PropertyKey>(
        obj: X,
        prop: Y
    ): obj is X & Record<Y, unknown> {
        return obj.hasOwnProperty(prop);
    }

    private resumeUserCode(): void {
        const currentTask: TaskBase = this.currentTask;
        this.context.isReplaying = currentTask.isPlayed;
        if (currentTask.stateObj === TaskState.Running) {
            return;
        }

        let newTask: TaskBase | undefined = undefined;
        try {
            const taskValue = currentTask.result;
            const taskSucceeded = currentTask.stateObj === TaskState.Completed;

            const generatorResult = taskSucceeded
                ? this.generator.next(taskValue)
                : this.generator.throw(taskValue);

            if (generatorResult.done) {
                this.orchestratorReturned = true;
                this.output = generatorResult.value;
                return;
            } else if (generatorResult.value instanceof TaskBase) {
                newTask = generatorResult.value;
            }
        } catch (exception) {
            this.exception = exception;
        }

        if (newTask !== undefined) {
            this.currentTask = newTask;
            if (newTask.state !== TaskState.Running) {
                this.resumeUserCode();
            } else {
                this.addToOpenTasks(newTask);
                if (this.currentTask instanceof ProperTask) {
                    this.addToActions(this.currentTask.actionObj);
                }
            }
        }
    }

    public addToActions(action: IAction): void {
        if (this.willContinueAsNew) {
            return;
        }

        this.actions.push(action);
    }

    public addToOpenTasks(task: TaskBase): void {
        if (task instanceof AtomicTask || task instanceof InternalOnlyTask) {
            if (task.id === "unassigned") {
                task.id = this.sequenceNumber++;
                this.openTasks[task.id] = task;
            } else if (task.id !== "ignorable") {
                let taskList = this.openTasks[task.id];
                if (taskList === undefined) {
                    taskList = [];
                }
                if (!(taskList instanceof TaskBase)) {
                    taskList.push(task);
                    this.openTasks[task.id] = taskList;
                }
            }

            if (this.deferredTasks.hasOwnProperty(task.id)) {
                const taskUpdateAction = this.deferredTasks[task.id];
                taskUpdateAction();
            }
        } else if (task instanceof CompoundTask) {
            for (const child of task.children) {
                this.addToOpenTasks(child);
            }
        }
    }
}
