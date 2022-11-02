import { InvocationContext } from "@azure/functions";
import { DurableOrchestrationContext } from "./classes";

export interface IOrchestrationFunctionContext extends InvocationContext {
    df: DurableOrchestrationContext;
}
