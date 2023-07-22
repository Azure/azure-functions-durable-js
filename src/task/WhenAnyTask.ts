import { TaskState } from ".";
import { CompoundTask } from "./CompoundTask";
import { TaskBase } from "./TaskBase";

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
        // For a Task to have isError = true, it needs to contain within an Exception/Error datatype.
        // However, WhenAny only contains Tasks as its result, so technically it "never errors out".
        // The isError flag is used simply to determine if the result of the task should be fed in
        // as a value, or as a raised exception to the generator code. For WhenAny, we always feed
        // in the result as a value.
        if (this.state === TaskState.Running) {
            this.setValue(false, child);
        }
    }
}
