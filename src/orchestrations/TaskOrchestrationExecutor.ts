import { OrchestrationFailureError } from "../error/OrchestrationFailureError";
import { OrchestratorState } from "./OrchestratorState";
import { TaskBase, NoOpTask, DFTask, CompoundTask, TaskState } from "../task";
import { ReplaySchema } from "./ReplaySchema";
import { Utils } from "../util/Utils";
import { DurableOrchestrationContext, OrchestrationContext } from "durable-functions";
import { CallEntityAction } from "../actions/CallEntityAction";
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
    private deferredTasks: Record<number | string, () => void>;
    private sequenceNumber: number;
    private schemaVersion: ReplaySchema;
    public willContinueAsNew: boolean;
    private actions: IAction[];
    protected openTasks: Record<number | string, TaskBase>;
    protected openEvents: Record<number | string, TaskBase[]>;
    private eventToTaskValuePayload: { [key in HistoryEventType]?: [boolean, string] };

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
        this.openTasks = {};
        this.openEvents = {};
        this.actions = [];
        this.deferredTasks = {};

        this.output = undefined;
        this.exception = undefined;
        this.orchestratorReturned = false;
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

        // Execute the orchestration, using the history for replay
        for (const historyEvent of history) {
            this.processEvent(historyEvent);
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
                // CallEntity and WaitForExternalEvent APIs.
                // For CallEntity, the EventRaised event that contains that API's result will
                // expect a TaskID that is different from the TaskID found at the root of this
                // EventSent event. Namely, the TaskID it expects can be found nested in the
                // "Input" field of the corresponding EventSent event. Here, we handle that
                // edge-case by correcting the expected TaskID in our openTask list.
                const key = event.EventId;
                const task = this.openTasks[key];
                if (task !== undefined) {
                    if (task.actionObj instanceof CallEntityAction) {
                        // extract TaskID from Input field
                        const eventSent = event as EventSentEvent;
                        const requestMessage = JSON.parse(
                            eventSent.Input as string
                        ) as RequestMessage;

                        // Obtain correct Task ID and update the task to be associated with it
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
                this.deferredTasks[key] = updateTask.bind(this);
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
        task.setValue(!isSuccess, taskResult);
    }

    /**
     * @hidden
     * Attempt to continue executing the orchestrator.
     */
    private tryResumingUserCode(): void {
        // If the current task does not have a result,
        // then we cannot continue running the user code.
        const currentTask: TaskBase = this.currentTask;
        this.context.isReplaying = currentTask.isPlayed;
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
                // The task hasn't completed, we add it to the open (incomplete) task list
                this.trackOpenTask(newTask);
                // We only keep track of actions from user-declared tasks, not from
                // tasks generated internally to facilitate history-processing.
                if (this.currentTask instanceof DFTask && !this.currentTask.alreadyScheduled) {
                    this.markAsScheduled(this.currentTask);
                    this.addToActions(this.currentTask.actionObj);
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
            // the history event that contains the result for this task. Therefore, we immediately
            // assign this task's result so that the user-code may proceed executing.
            if (this.deferredTasks.hasOwnProperty(task.id)) {
                const taskUpdateAction = this.deferredTasks[task.id];
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
