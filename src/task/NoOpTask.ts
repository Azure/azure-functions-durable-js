import { TaskBase } from "./TaskBase";

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
export class NoOpTask extends TaskBase {
    constructor() {
        super(false, "noOp");
    }
}
