import { BackingAction, TaskID, TaskState } from ".";
import { CompoundTask } from "./CompoundTask";

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
    get hasResult(): boolean {
        return this.state !== TaskState.Running;
    }

    get isFaulted(): boolean {
        return this.state === TaskState.Failed;
    }

    get isCompleted(): boolean {
        return this.state === TaskState.Completed;
    }

    /** Change this task from the Running state to a completed state */
    private changeState(state: TaskState): void {
        if (state === TaskState.Running) {
            throw Error("Cannot change Task to the RUNNING state.");
        }
        this.state = state;
    }

    /** Attempt to set a result for this task, and notifies parents, if any */
    public setValue(isError: boolean, value: unknown): void {
        let newState: TaskState;

        if (isError) {
            if (!(value instanceof Error)) {
                const errMessage = `Task ID ${this.id} failed but it's value was not an Exception`;
                throw new Error(errMessage);
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
