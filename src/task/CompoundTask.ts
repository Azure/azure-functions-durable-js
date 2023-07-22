import { IAction } from "../classes";
import { DFTask } from "./DFTask";
import { TaskBase } from "./TaskBase";

/**
 * @hidden
 *
 * A task that depends on the completion of other (sub-) tasks.
 */
export abstract class CompoundTask extends DFTask {
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

        // If the task has no children, throw an error
        // See issue here for why this isn't allowed: https://github.com/Azure/azure-functions-durable-js/issues/424
        if (children.length == 0) {
            const message =
                "When constructing a CompoundTask (such as Task.all() or Task.any()), you must specify at least one Task.";
            throw new Error(message);
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
