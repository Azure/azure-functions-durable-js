import { Context } from "@azure/functions";
import { DurableEntityContext } from "./classes";

export interface IEntityFunctionContext<T> extends Context {
    df: DurableEntityContext<T>;
}
