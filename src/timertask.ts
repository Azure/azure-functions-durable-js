import { CreateTimerAction, Task } from "./classes";

export class TimerTask extends Task {
    constructor(
        public readonly isCompleted: boolean,
        public readonly isFaulted: boolean,
        public readonly action: CreateTimerAction,
        public readonly result?: unknown,
        public readonly timestamp?: Date,
        public readonly id?: number,
    ) { super(isCompleted, isFaulted, action, result, timestamp, id); }

    get isCanceled(): boolean {
        return this.action && this.action.isCanceled;
    }

    public cancel() {
        if (!this.isCompleted) {
            this.action.isCanceled = true;
        } else {
            throw new Error("Cannot cancel a completed task.");
        }
    }
}
