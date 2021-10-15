import internal = require("assert");
import { time } from "console";
import { AnyKindOfDictionary, Dictionary, forEach, isError } from "lodash";
import { cpuUsage } from "process";
import { Err } from "typedoc/dist/lib/utils/result";
import { RetryOptions } from ".";
import { ICompoundAction } from "./actions/iaction";
import { CreateTimerAction, DurableOrchestrationContext, EventSentEvent, HistoryEvent, HistoryEventType, IAction, RequestMessage, Task } from "./classes";

enum TaskState {
    Running,
    Failed,
    Completed,
}

export abstract class TaskBase {

    protected state: TaskState;
    protected parent: CompoundTask | undefined;
    public apiName: string;
    public isPlayed: boolean;
    public result: unknown;

    constructor(
        public id: number,
        protected action: IAction | undefined
    ){
        this.state = TaskState.Running;
    }

    get actionObj(): IAction | undefined {
        return this.action;
    }

    get stateObj(): TaskState {
        return this.state;
    }

    get isCompleted(): boolean {
        return this.state !== TaskState.Running;
    }

    private changeState(state: TaskState): void {
        if (state === TaskState.Running){
            throw Error("Cannot change Task to the RUNNING state.");
        }
        this.state = state;
    }

    protected SetValue(isError: boolean, value: unknown): void {
        let new_state: TaskState;

        if (isError){
            if (value instanceof Error){
                if ((value instanceof TaskBase) && (value.result instanceof Error)) {
                    const errMessage = `Task ID ${this.id} failed but it's value was not an Exception`;
                    throw new Error(errMessage);
                }
            }
            new_state = TaskState.Failed;
        }
        else {
            new_state = TaskState.Completed;
        }

        this.changeState(new_state);
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

export abstract class CompoundTask extends TaskBase {
    protected firstError: Error | undefined;

    constructor(
        protected children: TaskBase[]
    ){
        super(-1, undefined);
        this.firstError = undefined;
    }

    public handleCompletion(child: TaskBase): void {

        if (!this.isPlayed){
            this.isPlayed = child.isPlayed;
        }
        this.trySetValue(child);
    }

    abstract trySetValue(child: TaskBase): void;

}

export class AtomicTask extends TaskBase {};

class TimerTask extends AtomicTask {

    constructor(
        public id: number,
        public action: CreateTimerAction){
            super(id, action);
    }

    get isCancelled(): boolean {
        return this.action.isCanceled;
    }

    public cancel(): void {
        if (this.isCompleted){
            throw Error("Cannot cancel a completed task.");
        }
        this.action.isCanceled = true; // TODO: this is a typo :)
    }

}

class WhenAllTask extends CompoundTask {

    constructor(protected children: TaskBase[]) {
        super(children);
    }

    public trySetValue(child: AtomicTask): void {
        if (child.stateObj === TaskState.Completed) {
            if (this.children.every(c => c.stateObj === TaskState.Completed)) {
                const results = this.children.map(c => c.result);
                this.SetValue(false, results);
            }
        }
        else {
            if (this.firstError === undefined) {
                this.firstError = child.result as Error;
                this.SetValue(true, this.firstError);
            }
        }
    }

}

class WhenAnyTask extends CompoundTask {

    public trySetValue(child: TaskBase): void {
        if (this.state === TaskState.Running) {
            this.SetValue(false, child.result);
        }
    }
}

export class RetryAbleTask extends WhenAllTask {
    private isWaitingOnTimer: boolean;
    private numAttempts: number;

    constructor(
        protected children: TaskBase[],
        private retryOptions: RetryOptions,
        private context: DurableOrchestrationContext
    ){
        super(children);
        this.numAttempts = 1;
        this.isWaitingOnTimer = false;
    }

    public trySetValue(child: TaskBase) {
        if (this.isWaitingOnTimer) {
            this.isWaitingOnTimer = false;

            const rescheduledTask = new AtomicTask(-1, undefined); // TODO: fix
            this.children.push(rescheduledTask);
        }
        else if (child.stateObj === TaskState.Completed) {
            if (this.children.every(c => c.stateObj === TaskState.Completed)){
                this.SetValue(false, child.result);
            }
        }
        else {
            if (this.numAttempts >= this.retryOptions.maxNumberOfAttempts) {
                this.SetValue(true, child.result);

            }
            else {
                const rescheduledTask = new AtomicTask(-1, undefined); // TODO: fix
                this.children.push(rescheduledTask);
                this.isWaitingOnTimer = true;
            }

            this.numAttempts++;
        }

    }
}

export class TaskOrchestrationExecutor {
    private context: DurableOrchestrationContext;
    protected openTasks: Record<number, TaskBase | TaskBase[]>;
    private eventToTaskValuePayload: { [key in HistoryEventType]? : [boolean, string]};

    constructor(){
        this.eventToTaskValuePayload = {
            [HistoryEventType.TaskCompleted] : [true, "TaskScheduledId"],
            [HistoryEventType.TimerFired] : [true, "TimerId"],
            [HistoryEventType.SubOrchestrationInstanceCompleted] : [true, "TaskScheduledId"],
            [HistoryEventType.EventRaised] : [true, "Name"],
            [HistoryEventType.TaskFailed] : [false, "TaskScheduledId"],
            [HistoryEventType.SubOrchestrationInstanceFailed] : [false, "TaskScheduledId"],
        }
        this.openTasks = {};
        this.initialize();
    }

    private initialize(): void {
        this.currentTask: TaskBase = new AtomicTask(-1, []);
        this.currentTask.setValue(isError=False, value=None)

        this.output;
        this.exception = None
        this.orchestratorReturned: bool = False
    }

    public execute(
        context: DurableOrchestrationContext,
        history: HistoryEvent[],
        fn: IterableIterator<unknown>
    ): string {
        this.context = context;
        const generator = fn(context); // what happens if code is not a generator?
        for (const historyEvent of history) {
            this.processEvent(historyEvent);
        }

        return "";
    }

    private hole<T>(id: string): T {
        throw new Error(`unfilled ${id}`) // types to bottom
    }

    private processEvent(event: HistoryEvent): void {
        function processSpecialEvents(event: HistoryEvent): boolean {
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
                    if (key in Object.keys(this.openTasks)) {
                        const task = this.openTasks[key];
                        if (task.apiName === "CallEntityAction") {
                            // review all of this :)
                            const eventSent = event as EventSentEvent;
                            const requestMessage = JSON.parse(eventSent.Input as string) as RequestMessage;
                            const event_id = Number(requestMessage.id);
                            delete this.openTasks[key]; // TODO: make sure this works
                            this.openTasks[event_id] = task;
                        }
                    }
                    return true;
                }
            }
            return false;
        }

        const eventType = event.EventType;
        const wasProcessed = processSpecialEvents(event);
        if (!wasProcessed){
            if (eventType in Object.keys(this.eventToTaskValuePayload)){
                var [isSuccess, idKey] = this.eventToTaskValuePayload[eventType] as [boolean, string];
                this.setTaskValue(event, isSuccess, idKey);
                this.resumeUserCode();

            }
        }
    }

    private setTaskValue(event: HistoryEvent, isSuccess: boolean, idKey: string): void {
        const key = event[(idKey as keyof typeof event)] as number; // TODO: a bit of magic here
        let task: TaskBase;
        const taskOrtaskList = this.openTasks[key];
        if (!(taskOrtaskList instanceof TaskBase)){
            const taskList = taskOrtaskList;
            task = taskList.pop() as TaskBase; //ensure the pop is in-place
            if (taskList.length > 0){
                this.openTasks[key] = taskList;
            }
        }

        if (isSuccess){
            newValue = ...
        }
        else {
            newValue = Error("....");
        }
        Task
        task.SetValue(!isSuccess, newValue);
    }

    private resumeUserCode(): void {
        currentTask = this.currentTask;
        this.context. ...
        if (currentTask.state ..)
    }

}
