import { OrchestrationFailureError } from "../error/OrchestrationFailureError";
import { OrchestratorState } from "./OrchestratorState";
import { TaskBase, NoOpTask, DFTask, CompoundTask, TaskState, LockTask } from "../task";
import { ReplaySchema } from "./ReplaySchema";
import { Utils } from "../util/Utils";
import { DurableOrchestrationContext, OrchestrationContext } from "durable-functions";
import type { DurableOrchestrationContext as DurableOrchestrationContextImpl } from "./DurableOrchestrationContext";
import { CallEntityAction } from "../actions/CallEntityAction";
import { LockEntitiesAction } from "../actions/LockEntitiesAction";
import { IAction } from "../actions/IAction";
import { WaitForExternalEventAction } from "../actions/WaitForExternalEventAction";
import { RequestMessage } from "../entities/RequestMessage";
import { ResponseMessage } from "../entities/ResponseMessage";
import { EventRaisedEvent } from "../history/EventRaisedEvent";
import { EventSentEvent } from "../history/EventSentEvent";
import { HistoryEvent } from "../history/HistoryEvent";
import { HistoryEventType } from "../history/HistoryEventType";
import { SubOrchestrationInstanceCompletedEvent } from "../history/SubOrchestrationInstanceCompletedEvent";
import { TaskCompletedEvent } from "../history/TaskCompletedEvent";

/**
 * @hidden
 * Utility class to manage orchestration replay
 */
export class TaskOrchestrationExecutor {
    private context: DurableOrchestrationContext;
    private currentTask: TaskBase;
    private output: unknown;
    private exception: Error | undefined;
    private orchestratorReturned: boolean;
    private generator: Generator<TaskBase, any, any>;
    private deferredTasks: Record<number | string, Array<() => void>>;
    private sequenceNumber: number;
    private schemaVersion: ReplaySchema;
    public willContinueAsNew: boolean;
    private actions: IAction[];
    protected openTasks: Record<number | string, TaskBase>;
    protected openEvents: Record<number | string, TaskBase[]>;
    private eventToTaskValuePayload: { [key in HistoryEventType]?: [boolean, string] };
    private _isReplaying: boolean;

    constructor() {
        // Map of task-completion events types to pairs of
        // (1) whether that event corresponds to a successful task result, and
        // (2) the field in the event type that would contain the task's ID.
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

    /**
     * @hidden
     *
     * Initialize the task orchestration executor for a brand new orchestrator invocation.
     * To be called in ContinueAsNew scenarios as well.
     */
    private initialize(): void {
        // The very first task, to kick-start the generator, is just a dummy/no-op task
        this.currentTask = new NoOpTask();
        this.currentTask.setValue(false, undefined);

        this.sequenceNumber = 0;
        this.willContinueAsNew = false;
        this.actions = [];
        // Use prototype-less objects so that string keys which happen to match
        // members of `Object.prototype` (e.g. an external event named "toString")
        // do not collide with inherited properties.
        this.openTasks = Object.create(null);
        this.openEvents = Object.create(null);
        this.deferredTasks = Object.create(null);

        this.output = undefined;
        this.exception = undefined;
        this.orchestratorReturned = false;
        this._isReplaying = false;
    }

    /**
     * @hidden
     *
     * Start an orchestration's execution, replaying based on the currently-available History.
     *
     * @param context
     *  The orchestration context
     * @param history
     *  The orchestration history
     * @param schemaVersion
     *  The OOProc output schema version expected by the DF extension
     * @param fn
     *  The user-code defining the orchestration
     *
     * @returns
     *  Returns void but communicates the resulting orchestrator state via the context object's handler
     */
    public async execute(
        context: OrchestrationContext,
        history: HistoryEvent[],
        schemaVersion: ReplaySchema,
        fn: (context: OrchestrationContext) => IterableIterator<unknown>
    ): Promise<OrchestratorState> {
        this.schemaVersion = schemaVersion;
        this.context = context.df;
        this.generator = fn(context) as Generator<TaskBase, any, any>;

        // Determine the index of the last OrchestratorStarted event in the history.
        // Events before this index belong to previous replay frames (isReplaying = true).
        // Events at or after this index belong to the current frame (isReplaying = false).
        // This approach does not rely on the IsPlayed flag, which some backends do not set.
        let lastOrchestratorStartedIndex = -1;
        for (let i = 0; i < history.length; i++) {
            if (history[i].EventType === HistoryEventType.OrchestratorStarted) {
                lastOrchestratorStartedIndex = i;
            }
        }

        // Execute the orchestration, using the history for replay
        for (let i = 0; i < history.length; i++) {
            this._isReplaying = i < lastOrchestratorStartedIndex;
            this.processEvent(history[i]);
            if (this.isDoneExecuting()) {
                break;
            }
        }

        // Construct current orchestration state
        const actions: IAction[][] = this.actions.length == 0 ? [[]] : [this.actions];
        const orchestratorState = new OrchestratorState({
            isDone: this.hasCompletedSuccessfully(),
            actions: actions,
            output: this.output,
            error: this.exception?.message,
            customStatus: this.context.customStatus,
            schemaVersion: this.schemaVersion,
        });

        // Throw errors, if any
        if (this.exception !== undefined) {
            throw new OrchestrationFailureError(this.orchestratorReturned, orchestratorState);
        }

        return orchestratorState;
    }

    /**
     * @hidden
     * Determine if the orchestrator should exit, either successfully or through an error.
     *
     * @returns
     *  True if the orchestration's invocation completed, or if an unhandled exception was thrown.
     *  False otherwise.
     */
    private isDoneExecuting(): boolean {
        return this.hasCompletedSuccessfully() || this.exception !== undefined;
    }

    /**
     * @hidden
     * Determine if the current invocation has finished.
     *
     * @returns
     *  True if the orchestration reached a `return` statement, or a `continueAsNew`.
     *  False otherwise.
     */
    private hasCompletedSuccessfully(): boolean {
        return this.orchestratorReturned || this.willContinueAsNew;
    }

    /**
     * @hidden
     * Processes a History event, often by either by updating some deterministic API value, updating
     * the state of a task, or resuming the user code.
     *
     * @param event
     *  The History event we're currently processing
     */
    private processEvent(event: HistoryEvent): void {
        const eventType = event.EventType;
        switch (eventType) {
            case HistoryEventType.OrchestratorStarted: {
                const timestamp = event.Timestamp;
                if (timestamp > this.context.currentUtcDateTime) {
                    this.context.currentUtcDateTime = timestamp;
                }
                break;
            }
            case HistoryEventType.ContinueAsNew: {
                // The clear all state from the orchestration,
                // as if no processing of History had taken place
                this.initialize();
                break;
            }
            case HistoryEventType.ExecutionStarted: {
                this.tryResumingUserCode();
                break;
            }
            case HistoryEventType.EventSent: {
                // The EventSent event requires careful handling because it is re-used among
                // CallEntity, LockEntities, and WaitForExternalEvent APIs.
                // For CallEntity/LockEntities, the completion event (EventRaised) carries
                // a TaskID that is different from the TaskID at the root of this EventSent
                // event. The expected TaskID lives in the "Input" field of the
                // corresponding EventSent (as the `id` of the RequestMessage). We handle
                // that edge-case here by re-keying the open task.
                const key = event.EventId;
                const task = this.openTasks[key];
                if (task !== undefined) {
                    if (
                        task.actionObj instanceof CallEntityAction ||
                        task.actionObj instanceof LockEntitiesAction
                    ) {
                        // extract TaskID from Input field
                        const eventSent = event as EventSentEvent;
                        const requestMessage = JSON.parse(
                            eventSent.Input as string
                        ) as RequestMessage;

                        // Obtain correct Task ID and update the task to be associated with it.
                        // For LockEntitiesAction this id equals the action's lockRequestId,
                        // and the upcoming EventRaised carrying "LockAcquisitionCompleted"
                        // is named with the same GUID -- which is how the worker matches
                        // lock-acquisition without a new history event type.
                        const eventId = requestMessage.id;
                        delete this.openTasks[key];
                        this.openTasks[eventId] = task;
                    }
                }
                break;
            }
            default:
                // If the current event contains task-completion data, we resolve that task to a value
                if (eventType in this.eventToTaskValuePayload) {
                    const [isSuccess, idKey] = this.eventToTaskValuePayload[eventType] as [
                        boolean,
                        string
                    ];
                    // We set the corresponding task's value and attempt to resume the orchestration
                    this.setTaskValue(event, isSuccess, idKey);
                    this.tryResumingUserCode();
                }
                break;
        }
    }

    /**
     * @hidden
     * Set a Task's result from a task-completion History event.
     *
     * @param event
     *  The History event containing task-completion information
     * @param isSuccess
     *  A flag indicating if the task failed or succeeded
     * @param idKey
     *  The property in the History event containing the Task's ID
     * @returns
     */
    private setTaskValue(event: HistoryEvent, isSuccess: boolean, idKey: string): void {
        /**
         * @hidden
         *
         * Extracts a task's result from its corresponding History event
         * @param completionEvent
         *  The History event corresponding to the task's completion
         * @returns
         *  The task's result
         */
        function extractResult(completionEvent: HistoryEvent): unknown {
            let taskResult: unknown;

            switch (completionEvent.EventType) {
                case HistoryEventType.SubOrchestrationInstanceCompleted:
                    taskResult = JSON.parse(
                        (completionEvent as SubOrchestrationInstanceCompletedEvent).Result
                    );
                    break;
                case HistoryEventType.TaskCompleted:
                    taskResult = JSON.parse((completionEvent as TaskCompletedEvent).Result);
                    break;
                case HistoryEventType.EventRaised:
                    const eventRaised = completionEvent as EventRaisedEvent;
                    taskResult =
                        eventRaised && eventRaised.Input
                            ? JSON.parse(eventRaised.Input)
                            : undefined;
                    break;
                default:
                    break;
            }
            return taskResult;
        }

        // First, we attempt to recover the task associated with this history event
        let task: TaskBase | undefined;
        const key = event[idKey as keyof typeof event];
        if (typeof key === "number" || typeof key === "string") {
            task = this.openTasks[key];
            const taskList: TaskBase[] | undefined = this.openEvents[key];
            if (task !== undefined) {
                // Remove task from open tasks
                delete this.openTasks[key];
            } else if (taskList !== undefined) {
                task = taskList.pop() as TaskBase;

                // We ensure openEvents only has an entry for this key if
                // there's at least 1 task to consume
                if (taskList.length == 0) {
                    delete this.openEvents[key];
                }
            } else {
                // If the task is in neither open tasks nor open events, then it must
                // correspond to the response of an external event that we have yet to wait for.
                // We track this by deferring the assignment of this task's result until after the task
                // is scheduled.
                const updateTask = function (): void {
                    this.setTaskValue(event, isSuccess, idKey);
                    return; // we return because the task is yet to be scheduled
                };
                if (this.deferredTasks[key] === undefined) {
                    this.deferredTasks[key] = [];
                }
                this.deferredTasks[key].push(updateTask.bind(this));
                return;
            }
        } else {
            throw Error(
                `Task with ID ${key} could not be retrieved from due to its ID-key being of type ${typeof key}. ` +
                    `We expect ID-keys to be of type number or string. ` +
                    `This is probably a replay failure, please file a bug report.`
            );
        }

        // After obtaining the task, we obtain its result.
        let taskResult: unknown;
        if (isSuccess) {
            // We obtain the task's result value from its corresponding History event.
            taskResult = extractResult(event);

            // CallEntity tasks need to further de-serialize its value from the
            // History event, we handle that next.
            const action = task.actionObj;
            if (action instanceof CallEntityAction) {
                const eventPayload = new ResponseMessage(taskResult);
                taskResult = eventPayload.result ? JSON.parse(eventPayload.result) : undefined;

                // Due to how ResponseMessage events are serialized, we can only
                // determine if they correspond to a failure at this point in
                // processing. As a result, we flip the "isSuccess" flag here
                // if an exception is detected.
                if (eventPayload.exceptionType !== undefined) {
                    taskResult = Error(taskResult as string);
                    isSuccess = false;
                }
            } else if (task instanceof LockTask) {
                // Replace the raw extension response with the DurableLock that
                // the LockTask carries (set at schedule time). This is the
                // value the orchestrator generator sees on `yield ctx.df.lock(...)`.
                taskResult = task.lockResult;
            }
        } else {
            // The task failed, we attempt to extract the Reason and Details from the event.
            if (
                Utils.hasStringProperty(event, "Reason") &&
                Utils.hasStringProperty(event, "Details")
            ) {
                taskResult = new Error(`${event.Reason} \n ${event.Details}`);
            } else {
                throw Error(
                    `Task with ID ${task.id} failed but we could not parse its exception data.` +
                        `This is probably a replay failure, please file a bug report.`
                );
            }
        }

        // Set result to the task, and update it's isPlayed flag.
        task.isPlayed = event.IsPlayed;
        task.setValue(!isSuccess, taskResult, this);

        // If this was a callEntity inside a critical section, mark the call
        // as no longer in flight so the orchestrator can issue another call
        // to the same locked entity. Done in both success and failure paths.
        if (task.actionObj instanceof CallEntityAction) {
            (this.context as DurableOrchestrationContextImpl)._onEntityCallResolved(
                task.actionObj.instanceId
            );
        }
    }

    /**
     * @hidden
     * Attempt to continue executing the orchestrator.
     */
    private tryResumingUserCode(): void {
        // If the current task does not have a result,
        // then we cannot continue running the user code.
        const currentTask: TaskBase = this.currentTask;
        this.context.isReplaying = this._isReplaying || currentTask.isPlayed;
        if (currentTask.stateObj === TaskState.Running) {
            return;
        }

        // We feed in the result of the current task to the generator
        let newTask: TaskBase | undefined = undefined;
        try {
            // In the WhenAny-case, the result of the current task is another Task.
            // Here, we make sure not to expose the internal task class by extracting
            // the user-facing representation of the task.
            const result = currentTask.result;
            const taskValue = result;
            const taskSucceeded = currentTask.stateObj === TaskState.Completed;

            // If the task succeeded, we feed the task result as a value;
            // otherwise, we feed it as an exception.
            const generatorResult = taskSucceeded
                ? this.generator.next(taskValue)
                : this.generator.throw(taskValue);

            if (generatorResult.done) {
                // If the generator returned (via a `return` statement),
                // then we capture the workflow's result result.
                this.orchestratorReturned = true;
                this.output = generatorResult.value;
                return;
            } else if (generatorResult.value instanceof DFTask) {
                // The generator yielded another task.
                newTask = generatorResult.value;
            } else {
                // non-task was yielded. This isn't supported
                let errorMsg = `Durable Functions programming constraint violation: Orchestration yielded data of type ${typeof generatorResult.value}.`;
                errorMsg +=
                    typeof generatorResult.value === "undefined"
                        ? ' This is likely a result of yielding a "fire-and-forget API" such as signalEntity or continueAsNew.' +
                          " These APIs should not be yielded as they are not blocking operations. Please remove the yield statement preceding those invocations." +
                          " If you are not calling those APIs, p"
                        : " Only Task types can be yielded. P";
                errorMsg +=
                    "lease check your yield statements to make sure you only yield Task types resulting from calling Durable Functions APIs.";

                throw Error(errorMsg);
            }
        } catch (exception) {
            // The generator threw an exception
            this.exception = exception;
        }

        if (newTask !== undefined) {
            // The generator returned an already-completed task,
            // so we try to run the user code again.
            this.currentTask = newTask;
            if (newTask.state !== TaskState.Running) {
                this.tryResumingUserCode();
            } else {
                // Record the action, but only for user-declared tasks we haven't scheduled yet
                // (skip internal/history-processing tasks and replayed ones).
                if (newTask instanceof DFTask && !newTask.alreadyScheduled) {
                    this.markAsScheduled(newTask);
                    this.addToActions(newTask.actionObj);
                }

                // Register the task as open (may resolve it immediately from a queued early event).
                this.trackOpenTask(newTask);

                // If the task got completed during registration, resume the generator now.
                if (newTask.state !== TaskState.Running) {
                    this.tryResumingUserCode();
                }
            }
        }
    }

    /**
     * @hidden
     * Add an action to the user-defined actions list.
     * It ignores the request if the orchestrator has already
     * signaled a "ContinueAsNew" operation.
     *
     * @param action
     *  User-defined action to track
     */
    public addToActions(action: IAction): void {
        if (!this.willContinueAsNew) {
            this.actions.push(action);
        }
    }

    public recordFireAndForgetAction(action: IAction): void {
        if (!this.willContinueAsNew) {
            this.addToActions(action);
            this.sequenceNumber++;
        }
    }

    /**
     * @hidden
     * Tracks this task as waiting for completion.
     * In the process, it assigns the task an ID if it doesn't have one already.
     *
     * @param task
     *  Task to add to open tasks or open events list
     */
    public trackOpenTask(task: NoOpTask | DFTask): void {
        // The open tasks and open events objects only track singular tasks, not compound ones.
        // Therefore, for a compound task, we recurse down to its inner sub-tasks add
        // record all singular tasks.
        if (task instanceof CompoundTask) {
            for (const child of task.children) {
                this.trackOpenTask(child);
            }
        } else {
            if (task.id === false) {
                // The task needs to be given an ID and then stored.
                task.id = this.sequenceNumber++;
                this.openTasks[task.id] = task;
            } else if (task.actionObj instanceof WaitForExternalEventAction) {
                // The ID of a  `WaitForExternalEvent` task is the name of
                // the external event it awaits. Given that multiple `WaitForExternalEvent`
                // tasks can await the same event name at once, we need
                // to store these tasks as a list.

                // Obtain the current list of tasks for this external event name.
                // If there's no such list, we initialize it.
                const candidateEventList: TaskBase[] | undefined = this.openEvents[task.id];
                const eventList = candidateEventList !== undefined ? candidateEventList : [];

                eventList.push(task);
                this.openEvents[task.id] = eventList;
            }

            // If the task's ID can be found in deferred tasks, then we have already processed
            // a history event that contains a result for this task. Drain one entry from the
            // per-ID FIFO queue to unblock the user code. The drain may complete this task
            // synchronously, so when several events share a name, each queued one is handed to the
            // next wait for that name as the generator advances.
            const taskId = task.id as number | string;
            const deferredQueue = this.deferredTasks[taskId];
            if (deferredQueue !== undefined && deferredQueue.length > 0) {
                const taskUpdateAction = deferredQueue.shift()!;
                if (deferredQueue.length === 0) {
                    delete this.deferredTasks[taskId];
                }
                taskUpdateAction();
            }
        }
    }

    /**
     * @hidden
     * Marks the current task (and all its children if it is a compound task) as already scheduled.
     * If a task is already scheduled, its backing action should not be added to the actions array
     *
     * @param task The task to mark as already scheduled.
     */
    public markAsScheduled(task: NoOpTask | DFTask): void {
        if (task instanceof CompoundTask) {
            task.alreadyScheduled = true;
            for (const child of task.children) {
                this.markAsScheduled(child);
            }
        } else if (task instanceof DFTask) {
            task.alreadyScheduled = true;
        }
    }
}
