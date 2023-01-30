import { FunctionOptions, FunctionTrigger, InvocationContext } from "@azure/functions";

/**
 * The response returned by DurableClient.readEntityState().
 */
export interface EntityStateResponse<T> {
    /**
     * Whether this entity exists or not.
     */
    entityExists: boolean;
    /**
     * The current state of the entity, if it exists, or default value otherwise.
     */
    entityState?: T;
}

/**
 * Context object passed to entity Functions.
 */
export interface EntityContext<T> extends InvocationContext {
    /**
     * Object containing all DF entity APIs and properties
     */
    df: DurableEntityContext<T>;
}

/**
 * Provides functionality for application code implementing an entity operation.
 * @param TState the JSON-serializable type of the Entity's state
 */
export interface DurableEntityContext<TState> {
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
    getState(initializer?: () => TState): TState | undefined;

    /**
     * Sets the current state of this entity.
     *
     * @param state The state of the entity.
     */
    setState(state: TState): void;

    /**
     * Gets the input for this operation.
     *
     * An operation invocation on an entity includes an operation name, which
     * states what operation to perform, and optionally an operation input.
     *
     * @returns The operation input, or undefined if none.
     */
    getInput<TInput = TState>(): TInput | undefined;

    /**
     * Returns the given result to the caller of this operation.
     *
     * @param result The result to return.
     */
    return<TResult = TState>(result: TResult): void;

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
}

/**
 * Entity ID type
 */
export interface EntityId {
    /**
     * The name of the entity class
     */
    readonly name: string;
    /**
     * The entity key.
     * Uniquely identifies an entity among all instances of the same class.
     */
    readonly key: string;
    /*
     * Serializes the Entity ID into a string
     */
    toString(): string;
}

/**
 * Type for a function that can be registered as a Durable Entity
 */
export type EntityHandler<T> = (context: EntityContext<T>) => void;

export interface EntityOptions<T> extends Partial<FunctionOptions> {
    handler: EntityHandler<T>;
}

export interface EntityTrigger extends FunctionTrigger {
    type: "entityTrigger";
}
