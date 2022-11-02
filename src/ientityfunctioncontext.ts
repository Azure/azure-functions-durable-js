import { InvocationContext } from "@azure/functions";
import { DurableEntityContext } from "./classes";

export interface IEntityFunctionContext<T> extends InvocationContext {
    df: DurableEntityContext<T>;
}
