import { FunctionOptions, FunctionTrigger, InvocationContext } from "@azure/functions";
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
