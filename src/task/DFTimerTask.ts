import { TimerTask } from "durable-functions";
import { AtomicTask } from "./AtomicTask";
import { TaskID } from ".";
import { CreateTimerAction } from "../actions/createtimeraction";

/**
 * @hidden
 * A timer task. This is the internal implementation to the user-exposed TimerTask interface, which
 * has a more restricted API.
 */
export class DFTimerTask extends AtomicTask implements TimerTask {
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

    /** Whether this timer task is canceled */
    get isCanceled(): boolean {
        return this.action.isCanceled;
    }

    /**
     * @hidden
     * Cancel this timer task.
     * It errors out if the task has already completed.
     */
    public cancel(): void {
        if (this.hasResult) {
            throw Error("Cannot cancel a completed task.");
        }
        this.action.isCanceled = true;
    }
}
