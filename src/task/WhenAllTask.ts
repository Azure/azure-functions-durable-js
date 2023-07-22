import { IAction } from "../classes";
import { CompoundTask } from "./CompoundTask";
import { TaskBase } from "./TaskBase";
import { AtomicTask } from "./AtomicTask";
import { TaskState } from ".";

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
                this.setValue(false, results);
            }
        } else {
            // If any task failed, we fail the entire compound task
            if (this.firstError === undefined) {
                this.firstError = child.result as Error;
                this.setValue(true, this.firstError);
            }
        }
    }
}
