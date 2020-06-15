import { EntityId } from "./classes";

/**
 * Provides functionality for application code implementing an entity
 * operation.
 */
export class DurableEntityContext {
    /**
     * Gets the name of the currently executing entity.
     */
    public readonly entityName: string;

    /**
     * Gets the key of the currently executing entity.
     */
    public readonly entityKey: string;

    /**
     * Gets the id of the currently executing entity.
     */
    public readonly entityId: EntityId;

    /**
     * Gets the name of the operation that was called.
     *
     * An operation invocation on an entity includes an operation name, which
     * states what operation to perform, and optionally an operation input.
     */
    public readonly operationName: string | undefined;

    /**
     * Whether this entity is freshly constructed, i.e. did not exist prior to
     * this operation being called.
     */
    public readonly isNewlyConstructed: boolean;

    /**
     * Gets the current state of this entity, for reading and/or writing.
     *
     * @param initializer Provides an initial value to use for the state,
     * instead of TState's default.
     * @returns The current state of this entity, or undefined if none has been set yet.
     */
    public getState<T>(initializer?: () => T): T | undefined {
        throw new Error("This is a placeholder.");
    }

    /**
     * Sets the current state of this entity.
     *
     * @param state The state of the entity.
     */
    public setState<T>(state: T): void {
        throw new Error("This is a placeholder.");
    }

    /**
     * Gets the input for this operation.
     *
     * An operation invocation on an entity includes an operation name, which
     * states what operation to perform, and optionally an operation input.
     *
     * @returns The operation input, or undefined if none.
     */
    public getInput<T>(): T | undefined {
        throw new Error("This is a placeholder.");
    }

    /**
     * Returns the given result to the caller of this operation.
     *
     * @param result The result to return.
     */
    public return<T>(result: T): void {
        throw new Error("This is a placeholder.");
    }

    /**
     * Deletes this entity after this operation completes.
     */
    public destructOnExit(): void {
        throw new Error("This is a placeholder.");
    }

    /**
     * Signals an entity to perform an operation, without waiting for a
     * response. Any result or exception is ignored (fire and forget).
     *
     * @param entity The target entity.
     * @param operationName The name of the operation.
     * @param operationInput The operation input.
     */
    public signalEntity(entity: EntityId, operationName: string, operationInput?: unknown): void {
        throw new Error("This is a placeholder.");
    }
}
