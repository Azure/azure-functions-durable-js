import { Context } from "@azure/functions";
import { DurableOrchestrationContext } from "./classes";

export interface IOrchestrationFunctionContext<T> extends Context {
    df: DurableOrchestrationContext<T>;
}
