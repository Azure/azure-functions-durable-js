import { Context } from "@azure/functions";
import { DurableOrchestrationContext } from "./classes";

export interface IOrchestrationFunctionContext extends Context {
    df: DurableOrchestrationContext;
}
