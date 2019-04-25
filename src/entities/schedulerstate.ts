/** @hidden */
export class SchedulerState {
    constructor(
    /** Whether this entity exists or not */
    public exists?: boolean,    // EntityExists

    /**
     * The serialized entity state. This can be stale while
     * CurrentStateView != null.
     */
    public state?: string,      // EntityState

    /** The queue of waiting operations, or null if none. */
    public queue?: unknown,     // Queue
    // TODO: what type should this be/is it ever used on this side?

    /**
     * The instance id of the orchestration that currently holds the lock of
     * this entity.
     */
    public lockedBy?: string,   // LockedBy
    ) { }
}
