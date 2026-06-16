import { IAction } from "../actions/IAction";
import { DurableLock } from "../entities/DurableLock";
import { AtomicTask } from "./AtomicTask";

/**
 * @hidden
 * An {@link AtomicTask} that resolves to a {@link DurableLock}.
 *
 * The lock instance is carried as a typed, readonly field so the executor can
 * hand it back to the orchestrator when the lock action completes.
 */
export class LockTask extends AtomicTask {
    constructor(action: IAction, public readonly lockResult: DurableLock) {
        // `false` is the TaskID for an un-awaited task, matching how `lock()`
        // previously constructed its AtomicTask.
        super(false, action);
    }
}
