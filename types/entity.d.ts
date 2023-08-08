import { FunctionOptions, FunctionTrigger, InvocationContext, LogHandler } from "@azure/functions";
import { DurableClient, OrchestrationContext, Task, TaskHubOptions } from "durable-functions";

export type EntityHandler<T = unknown> = (context: EntityContext<T>) => void;

export interface EntityOptions<T> extends Partial<FunctionOptions> {
    handler: EntityHandler<T>;
}

export interface EntityTrigger extends FunctionTrigger {
    type: "entityTrigger";
}

/**
 * Context object passed to entity Functions.
 */
export interface EntityContext<T = unknown> extends InvocationContext {
    /**
     * Object containing all DF entity APIs and properties
     */
    df: DurableEntityContext<T>;
}

/**
 * An entity context with dummy default values to facilitate mocking/stubbing the
 * Durable Functions API.
 */
export declare class DummyEntityContext<T> extends InvocationContext implements EntityContext<T> {
    /**
     * Creates a new instance of a dummy entity context.
     * All parameters are optional but are exposed to enable flexibility
     * in the testing process.
     *
     * @param functionName The name of the entity function
     * @param invocationId The ID of this particular invocation of the entity function
     * @param logHandler A handler to emit logs coming from the entity function
     */
    constructor(functionName?: string, invocationId?: string, logHandler?: LogHandler);

    df: DurableEntityContext<T>;
}

/**
 * This class should be extended by all entities that are registered
 *  using `app.classEntity()`.
 */
export declare abstract class EntityClass<T = unknown> {
    state: T;

    [key: string]: T | ((input?: unknown) => T | void);
}

export type ClassMethods<Class> = {
    [Property in keyof Class]: Class[Property] extends (...args: any[]) => any ? Property : never;
};

export type RegisteredEntityMethodsForOrchestrations<
    T = unknown,
    Base extends EntityClass<T> = EntityClass<T>
> = {
    [Property in keyof ClassMethods<Omit<Base, "state">>]: (input?: unknown) => CallEntityTask;
};

export type RegisteredEntityMethodsForClients<
    T = unknown,
    Base extends EntityClass<T> = EntityClass<T>
> = {
    [Property in keyof ClassMethods<Omit<Base, "state">>]: (
        input?: unknown,
        options?: TaskHubOptions
    ) => Promise<void> | Promise<EntityStateResponse<T>>;
};

export declare abstract class RegisteredEntityForOrchestrationsBase {
    constructor(id: string, context: OrchestrationContext);

    [key: string]: (input?: unknown) => CallEntityTask;
}

export declare abstract class RegisteredEntityForClientsBase<T> {
    constructor(id: string, client: DurableClient);

    readState(options?: TaskHubOptions): Promise<EntityStateResponse<T>>;

    [key: string]: (
        input?: unknown,
        options?: TaskHubOptions
    ) => Promise<void> | Promise<EntityStateResponse<T>>;
}

// export type RegisteredEntityForOrchestrations<
//     T = unknown,
//     Base extends EntityClass<T> = EntityClass<T>
// > = RegisteredEntityForOrchestrationsBase & RegisteredEntityMethodsForOrchestrations<T, Base>;

export type RegisteredEntityForOrchestrations<
    T = unknown,
    Base extends EntityClass<T> = EntityClass<T>
> = new (
    /**
     * The ID of the entity to call or signal
     */
    id: string,
    /**
     * The `OrchestrationContext` of the current orchestration
     */
    orchestrationContext: OrchestrationContext
) => RegisteredEntityForOrchestrationsBase & RegisteredEntityMethodsForOrchestrations<T, Base>;

export type RegisteredEntityForClients<
    T = unknown,
    Base extends EntityClass<T> = EntityClass<T>
> = new (
    /**
     * The ID of the entity to manage
     */
    id: string,
    /**
     * The `DurableClient` to use to manage the entity
     */
    durableClient: DurableClient
) => RegisteredEntityForClientsBase<T> & RegisteredEntityMethodsForClients<T, Base>;

/**
 * The result of registering an entity class using `app.classEntity()`.
 */
export interface RegisteredEntity<T = unknown, Base extends EntityClass<T> = EntityClass<T>> {
    /**
     * This constructor returns a class instance which can be used to call or signal an entity,
     *  with a specific entity ID.
     */
    orchestration: RegisteredEntityForOrchestrations<T, Base>;

    /**
     * This constructor returns a class instance which can be used to call an entity or read its state,
     *  with a specific entity ID.
     */
    client: RegisteredEntityForClients<T, Base>;
}

/**
 * By default, this Task blocks execution of the orchestration when yielded,
 *  until the entity responds to the call.
 *
 * If calling `.signal()`, the entity is signalled instead, which is a fire-and-forget operation.
 *  Please do not yield any calls to `.signal()`.
 */
export interface CallEntityTask extends Task {
    signal(): void;
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
 * A unique identifier for an entity, consisting of entity class and entity key.
 */
export declare class EntityId {
    /**
     * Create an entity id for an entity.
     * @param name The name of the entity class.
     * @param key The entity key. Uniquely identifies an entity among all instances of the same class.
     * @returns an `EntityId` instance
     */
    constructor(name: string, key: string);

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
 * The response returned by DurableClient.readEntityState().
 */
export declare class EntityStateResponse<T> {
    /**
     * Whether this entity exists or not.
     */
    entityExists: boolean;
    /**
     * The current state of the entity, if it exists, or default value otherwise.
     */
    entityState?: T;

    /**
     *
     * @param entityExists Whether this entity exists or not.
     * @param entityState The current state of the entity, if it exists, or default value otherwise.
     */
    constructor(entityExists: boolean, entityState?: T);
}
