import {
    FunctionInput,
    FunctionHandler,
    FunctionOutput,
    FunctionTrigger,
    FunctionOptions,
} from "@azure/functions";
import { IEntityFunctionContext } from "../src/ientityfunctioncontext";
import { IOrchestrationFunctionContext } from "../src/iorchestrationfunctioncontext";
import { DurableOrchestrationClient } from "./durableorchestrationclient";
import { Task as TaskTask, TimerTask as TimerTaskTask } from "./task";

// orchestrations
export type OrchestrationContext = IOrchestrationFunctionContext;

export type OrchestrationHandler = (
    context: OrchestrationContext
) => Generator<
    Task, // orchestrations yield Task types
    any, // return type of the orchestration
    any // what the SDK passes back to the orchestration
>;

export type Task = TaskTask;
export type TimerTask = TimerTaskTask;

export interface OrchestrationOptions extends Partial<FunctionOptions> {
    handler: OrchestrationHandler;
}

export interface OrchestrationTrigger extends FunctionTrigger {
    type: "orchestrationTrigger";
}

// entities
export type EntityContext<T> = IEntityFunctionContext<T>;
export type EntityHandler<T> = (context: EntityContext<T>) => void;

export interface EntityOptions<T> extends Partial<FunctionOptions> {
    handler: EntityHandler<T>;
}

export interface EntityTrigger extends FunctionTrigger {
    type: "entityTrigger";
}

// activities
export type ActivityHandler = FunctionHandler;

export interface ActivityOptions extends Partial<FunctionOptions> {
    handler: ActivityHandler;
    extraInputs?: FunctionInput[];
    extraOutputs?: FunctionOutput[];
}

export interface ActivityTrigger extends FunctionTrigger {
    type: "activityTrigger";
}

// clients
export interface DurableClientInput extends FunctionInput {
    type: "durableClient";
}

export type DurableClient = DurableOrchestrationClient;
