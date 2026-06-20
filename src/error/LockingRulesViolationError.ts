/**
 * Error thrown when an orchestration violates one of the locking rules
 * enforced inside a critical section (see DurableOrchestrationContext.lock).
 */
export class LockingRulesViolationError extends Error {
    public static readonly code = "LOCKING_RULES_VIOLATION";

    constructor(message: string, options?: { cause?: unknown }) {
        super(message);
        this.name = "LockingRulesViolationError";
        if (options && "cause" in options) {
            // ES2022 `cause` propagation for runtimes that don't pass it via super().
            (this as Error & { cause?: unknown }).cause = options.cause;
        }
        // Restore prototype chain for ES5/ES2015 transpile targets so
        // `err instanceof LockingRulesViolationError` works everywhere.
        Object.setPrototypeOf(this, LockingRulesViolationError.prototype);
    }
}

/**
 * Canonical message strings for locking-rule violations.
 * Centralized so tests can assert against the same constants.
 */
export const LockingRulesViolationMessages = {
    NestedSection: "Cannot acquire more locks when already holding some locks.",
    SubOrchestrationInSection: "Cannot invoke sub-orchestrations from within a critical section.",
    CallUnlockedEntity:
        "Cannot call an entity from within a critical section unless it is one of the locked entities.",
    ParallelSameEntity:
        "Cannot call the same entity multiple times in parallel within a critical section.",
    SignalLockedEntity:
        "Cannot signal an entity from within a critical section if the entity is one of the locked entities.",
} as const;
