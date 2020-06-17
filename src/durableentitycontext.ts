import { EntityId } from "./classes";

/**
 * Provides functionality for application code implementing an entity
 * operation.
 */
export type DurableEntityContext<T> = {
    /**
     * Gets the name of the currently executing entity.
     */
    readonly entityName: string;

    /**
     * Gets the key of the currently executing entity.
     */
    readonly entityKey: string;

    /**
     * Gets the id of the currently executing entity.
     */
    readonly entityId: EntityId;

    /**
     * Gets the name of the operation that was called.
     *
     * An operation invocation on an entity includes an operation name, which
     * states what operation to perform, and optionally an operation input.
     */
    readonly operationName: string | undefined;

    /**
     * Whether this entity is freshly constructed, i.e. did not exist prior to
     * this operation being called.
     */
    readonly isNewlyConstructed: boolean;

    /**
     * Gets the current state of this entity, for reading and/or writing.
     *
     * @param initializer Provides an initial value to use for the state,
     * instead of TState's default.
     * @returns The current state of this entity, or undefined if none has been set yet.
     */
    getState(initializer?: () => T): T | undefined;

    /**
     * Sets the current state of this entity.
     *
     * @param state The state of the entity.
     */
    setState(state: T): void;

    /**
     * Gets the input for this operation.
     *
     * An operation invocation on an entity includes an operation name, which
     * states what operation to perform, and optionally an operation input.
     *
     * @returns The operation input, or undefined if none.
     */
    getInput(): T | undefined;

    /**
     * Returns the given result to the caller of this operation.
     *
     * @param result The result to return.
     */
    return(result: T): void;

    /**
     * Deletes this entity after this operation completes.
     */
    destructOnExit(): void;

    /**
     * Signals an entity to perform an operation, without waiting for a
     * response. Any result or exception is ignored (fire and forget).
     *
     * @param entity The target entity.
     * @param operationName The name of the operation.
     * @param operationInput The operation input.
     */
    signalEntity(entity: EntityId, operationName: string, operationInput?: unknown): void;
};
