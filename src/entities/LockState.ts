import { EntityId } from "./EntityId";

/**
 * @hidden
 * Returned by [DurableOrchestrationContext].[isLocked] and
 * [DurableEntityContext].[isLocked].
 */
export class LockState {
    constructor(
        /** Whether the context already holds some locks. */
        public readonly isLocked: boolean,
        /** The locks held by the context. */
        public readonly ownedLocks: EntityId[]
    ) {}
}
