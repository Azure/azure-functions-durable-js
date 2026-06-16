import { EntityId } from "./EntityId";

// Polyfill Symbol.dispose on Node <20, where the `[Symbol.dispose]()` member below needs it
// (`using` only reads this symbol). `configurable: true` and try/catch keep it non-destructive.
if (typeof (Symbol as { dispose?: symbol }).dispose !== "symbol") {
    try {
        Object.defineProperty(Symbol, "dispose", {
            value: Symbol("Symbol.dispose"),
            writable: false,
            enumerable: false,
            configurable: true,
        });
    } catch {
        // Another polyfill defined it first so we read the global
        // `Symbol.dispose` when wiring up the `[Symbol.dispose]()` member below.
    }
}

/**
 * Returned by yielding `DurableOrchestrationContext.lock(...)`. Represents
 * the critical section over the locked entities.
 *
 * Release options (in recommended order):
 *   1. `using` syntax (TS >=5.2 or plain JS on Node >=24). Invokes
 *      `[Symbol.dispose]()` at block exit, which is an alias for `release()`.
 *   2. `try/finally` calling `release()`.
 *   3. Implicit release at orchestration completion (handled by the extension).
 *
 * `release()` is idempotent.
 */
export class DurableLock {
    /** The locks held by this critical section, in deterministic (sorted) order. */
    public readonly ownedLocks: ReadonlyArray<EntityId>;

    private released = false;
    private readonly onRelease: () => void;

    /**
     * @hidden
     * Tracks scheduler-ids of entity calls scheduled inside the section but
     * not yet resolved, used to enforce the "no parallel call to same locked
     * entity" rule.
     */
    public readonly inFlightEntityCalls: Set<string> = new Set<string>();

    /** @hidden */
    constructor(ownedLocks: EntityId[], onRelease: () => void) {
        // Defensive freeze so plain-JS callers can't mutate the held-lock list at runtime.
        // (`ReadonlyArray<T>` is compile-time only.)
        this.ownedLocks = Object.freeze([...ownedLocks]);
        this.onRelease = onRelease;
    }

    /**
     * Release the lock. Idempotent.
     *
     * Emits a `ReleaseEntities` action that the extension translates into
     * `DurableOrchestrationContext.ReleaseLocks()`. If the lock has already
     * been released (or the orchestration has ended), this is a no-op.
     */
    public release(): void {
        if (this.released) {
            return;
        }
        this.released = true;
        this.inFlightEntityCalls.clear();
        this.onRelease();
    }

    /**
     * Alias for `release()`, enabling the `using` statement (TS >=5.2 / Node >=24).
     */
    public [Symbol.dispose](): void {
        this.release();
    }

    /** @hidden */
    public get isReleased(): boolean {
        return this.released;
    }
}
