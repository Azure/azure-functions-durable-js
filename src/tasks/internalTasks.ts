import { RetryOptions } from "..";
import { IAction, CreateTimerAction } from "../classes";
import { TaskOrchestrationExecutor } from "../taskorchestrationexecutor";
import { Task } from "./externalTasks";

/**
 * @hidden
 * The states a task can be in
 */
export enum TaskState {
    Running,
    Failed,
    Completed,
}

/**
 * @hidden
 * A taskID, either a `string` for external events,
 * or either `false` or a `number` for un-awaited
 * an awaited tasks respectively.
 */
export type TaskID = number | string | false;

/**
 * @hidden
 * A backing action, either a proper action or "noOp" for an internal-only task
 */
export type BackingAction = IAction | "noOp";

/**
 * @hidden
 * Base class for all Tasks, defines the basic state transitions for all tasks.
 */
export abstract class TaskBase {
    public state: TaskState;
    public parent: CompoundTask | undefined;
    public isPlayed: boolean;
    public result: unknown;

    /**
     * @hidden
     *
     * Construct a task.
     * @param id
     *  The task's ID
     * @param action
     *  The task's backing action
     */
    constructor(public id: TaskID, protected action: BackingAction) {
        this.state = TaskState.Running;
    }

    /** Get this task's backing action */
    get actionObj(): BackingAction {
        return this.action;
    }

    /** Get this task's current state */
    get stateObj(): TaskState {
        return this.state;
    }

    /** Whether this task is not in the Running state */
    get isCompleted(): boolean {
        return this.state !== TaskState.Running;
    }

    /** Change this task from the Running state to a completed state */
    private changeState(state: TaskState): void {
        if (state === TaskState.Running) {
            throw Error("Cannot change Task to the RUNNING state.");
        }
        this.state = state;
    }

    /** Attempt to set a result for this task, and notifies parents, if any */
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

    /**
     * @hidden
     * Notifies this task's parents about its state change.
     */
    private propagate(): void {
        const hasCompleted = this.state !== TaskState.Running;
        if (hasCompleted && this.parent !== undefined) {
            this.parent.handleCompletion(this);
        }
    }
}

/**
 * @hidden
 *
 * A task created only to facilitate replay, it should not communicate any
 * actions to the DF extension.
 *
 * We internally track these kinds of tasks to reason over the completion of
 * DF APIs that decompose into smaller DF APIs that the user didn't explicitly
 * schedule.
 */
export class InternalOnlyTask extends TaskBase {
    constructor() {
        super(false, "noOp");
    }
}

/**
 * @hidden
 * A task that should result in an Action being communicated to the DF extension.
 */
export class ProperTask extends TaskBase {
    protected action: IAction;
    public externalTask: Task | undefined;

    /** Get this task's backing action */
    get actionObj(): IAction {
        return this.action;
    }
}

/**
 * @hidden
 *
 * A task that depends on the completion of other (sub-) tasks.
 */
export abstract class CompoundTask extends ProperTask {
    protected firstError: Error | undefined;

    /**
     * @hidden
     * Construct a Compound Task.
     * Primarily sets the parent pointer of each sub-task to be `this`.
     *
     * @param children
     *  The sub-tasks that this task depends on
     * @param action
     *  An action representing this compound task
     */
    constructor(public children: TaskBase[], protected action: IAction) {
        super(false, action);
        children.map((c) => (c.parent = this));
        this.firstError = undefined;

        // If the task has no children, then it's completed by definition.
        if (children.length == 0) {
            this.state = TaskState.Completed;
        }
    }

    /**
     * @hidden
     * Tries to set this task's result based on the completion of a sub-task
     * @param child
     *  A sub-task of this task.
     */
    public handleCompletion(child: TaskBase): void {
        if (!this.isPlayed) {
            this.isPlayed = child.isPlayed;
        }
        this.trySetValue(child);
    }

    /**
     * @hidden
     *
     * Task-internal logic for attempting to set this tasks' result
     * after any of its sub-tasks completes.
     * @param child
     *  A sub-task
     */
    abstract trySetValue(child: TaskBase): void;
}

export class AtomicTask extends ProperTask {}

/**
 * @hidden
 * A timer task. This is the internal interface to the user-exposed TimerTask, which
 * has a more restricted API.
 */
export class InnerTimerTask extends AtomicTask {
    /**
     * @hidden
     * Construct a Timer Task.
     *
     * @param id
     *  The task's ID
     * @param action
     *  The backing action of this task
     */
    constructor(public id: TaskID, public action: CreateTimerAction) {
        super(id, action);
    }

    /** Whether this timer task is cancelled */
    get isCancelled(): boolean {
        return this.action.isCancelled;
    }

    /**
     * @hidden
     * Cancel this timer task.
     * It errors out if the task has already completed.
     */
    public cancel(): void {
        if (this.isCompleted) {
            throw Error("Cannot cancel a completed task.");
        }
        this.action.isCancelled = true; // TODO: fix typo
    }
}

/**
 * @hidden
 *
 * A WhenAll task.
 */
export class WhenAllTask extends CompoundTask {
    /**
     * @hidden
     * Construct a WhenAll task.
     *
     * @param children
     *  Sub-tasks to wait on.
     * @param action
     *  A the backing action representing this task.
     */
    constructor(public children: TaskBase[], protected action: IAction) {
        super(children, action);
    }

    /**
     * @hidden
     * Attempts to set a value to this task, given a completed sub-task
     *
     * @param child
     *  The sub-task that just completed
     */
    public trySetValue(child: AtomicTask): void {
        if (child.stateObj === TaskState.Completed) {
            // We set the result only after all sub-tasks have completed
            if (this.children.every((c) => c.stateObj === TaskState.Completed)) {
                // The result is a list of all sub-task's results
                const results = this.children.map((c) => c.result);
                this.SetValue(false, results);
            }
        } else {
            // If any task failed, we fail the entire compound task
            if (this.firstError === undefined) {
                this.firstError = child.result as Error;
                this.SetValue(true, this.firstError);
            }
        }
    }
}

/**
 * @hidden
 *
 * A WhenAny task.
 */
export class WhenAnyTask extends CompoundTask {
    /**
     * @hidden
     * Attempts to set a value to this task, given a completed sub-task
     *
     * @param child
     *  The sub-task that just completed
     */
    public trySetValue(child: TaskBase): void {
        if (this.state === TaskState.Running) {
            this.SetValue(false, child);
        }
    }
}

/**
 * @hidden
 *
 * A `-WithRetry` Task.
 * It is modeled after a `WhenAllTask` because it decomposes
 * into several sub-tasks (a growing sequence of timers and atomic tasks)
 * that all need to complete before this task reaches an end-value.
 */
export class RetryAbleTask extends WhenAllTask {
    private isWaitingOnTimer: boolean;
    private numAttempts: number;
    private error: any;

    /**
     * @hidden
     * Construct a retriable task.
     *
     * @param innerTask
     *  The task representing the work to retry
     * @param retryOptions
     *  The retrying settings
     * @param executor
     *  The taskOrchestrationExecutor managing the replay,
     *  we use to to scheduling new tasks (timers and retries)
     */
    constructor(
        public innerTask: ProperTask,
        private retryOptions: RetryOptions,
        private executor: TaskOrchestrationExecutor
    ) {
        super([innerTask], innerTask.actionObj);
        this.numAttempts = 1;
        this.isWaitingOnTimer = false;
    }

    /**
     * @hidden
     * Attempts to set a value to this task, given a completed sub-task
     *
     * @param child
     *  The sub-task that just completed
     */
    public trySetValue(child: TaskBase): void {
        if (this.isWaitingOnTimer) {
            this.isWaitingOnTimer = false;

            // If we're out of retry attempts, we can set the output value
            // of this task to be that of the last error we encountered
            if (this.numAttempts >= this.retryOptions.maxNumberOfAttempts) {
                this.SetValue(true, this.error);
            } else {
                // If we still have more attempts available, we re-schedule the
                // original task. Since these sub-tasks are not user-managed,
                // they are declared as internal tasks.
                const rescheduledTask = new InternalOnlyTask();
                rescheduledTask.parent = this;
                this.children.push(rescheduledTask);
                this.executor.trackOpenTask(rescheduledTask);
                this.numAttempts++;
            }
        } else if (child.stateObj === TaskState.Completed) {
            // If we have a successful non-timer task, we accept its result
            this.SetValue(false, child.result);
        } else {
            // If the sub-task failed, schedule timer to retry again.
            // Since these sub-tasks are not user-managed, they are declared as internal tasks.
            const rescheduledTask = new InternalOnlyTask();
            rescheduledTask.parent = this;
            this.children.push(rescheduledTask);
            this.executor.trackOpenTask(rescheduledTask);
            this.isWaitingOnTimer = true;
            this.error = child.result;
        }
    }
}
