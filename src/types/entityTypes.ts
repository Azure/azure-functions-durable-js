import { FunctionOptions, FunctionTrigger, InvocationContext } from "@azure/functions";
import { EntityId } from "..";
import { DurableEntityContext } from "../durableentitycontext";

export type EntityHandler<T> = (context: EntityContext<T>) => void;

export interface EntityOptions<T> extends Partial<FunctionOptions> {
    handler: EntityHandler<T>;
}

export interface EntityTrigger extends FunctionTrigger {
    type: "entityTrigger";
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
 * The return value of a call to `df.app.entity()`
 */
export interface Entity {
    /**
     * Returns a new `EntityId` instance with the specified key. Can be passed to entity operation APIs.
     *
     * @param key the id to uniquely identity an entity instance among all instances of the same class.
     * @returns an `EntityId` instance using the registered entity name and the specified key.
     */
    getEntityId: (key: string) => EntityId;
}
