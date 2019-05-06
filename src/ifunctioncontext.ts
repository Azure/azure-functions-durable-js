import { Context } from "@azure/functions";
import { DurableOrchestrationContext } from "./classes";

export interface IFunctionContext extends Context {
    df: DurableOrchestrationContext;
}
