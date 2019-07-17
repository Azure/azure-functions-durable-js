import { Context } from "@azure/functions";
import { DurableEntityContext } from "./classes";

export interface IEntityFunctionContext extends Context {
    df: DurableEntityContext;
}
