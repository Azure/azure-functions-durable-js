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
    public readonly operationName: string;

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
     * @returns The current state of this entity.
     */
    public getState<TState>(initializer?: () => TState): TState | undefined {
        throw new Error("This is a placeholder.");
    }

    /**
     * Sets the current state of this entity.
     *
     * @param state The JSON-serializable state of the entity.
     */
    public setState<TState>(state: TState): void {
        throw new Error("This is a placeholder.");
    }

    /**
     * Gets the input for this operation, as a deserialized value.
     *
     * An operation invocation on an entity includes an operation name, which
     * states what operation to perform, and optionally an operation input.
     *
     * @returns The operation input, or TInput's default if none.
     */
    public getInput<TInput>(): TInput | undefined {
        throw new Error("This is a placeholder.");
    }

    /**
     * Returns the given result to the caller of this operation.
     *
     * @param result The result to return.
     */
    public return<TResult>(result: TResult): void {
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
