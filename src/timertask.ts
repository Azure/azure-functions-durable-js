import { CreateTimerAction, Task } from "./classes";

export class TimerTask extends Task {
    constructor(
        public isCompleted: boolean,
        public isCanceled: boolean,
        public action: CreateTimerAction,
        public result?: any,
        public timestamp?: Date,
        public id?: number,
    ) { super(isCompleted, action, result, timestamp, id); }
    public cancel() {
        if (!this.isCompleted) {
            this.action.isCanceled = true;
        } else {
            throw new Error("Cannot cancel a completed task.");
        }
    }
}
