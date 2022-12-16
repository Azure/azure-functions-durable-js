import {
    FunctionInput,
    FunctionHandler,
    InvocationContext,
    FunctionResult,
    FunctionOutput,
    FunctionTrigger,
} from "@azure/functions";
import { IEntityFunctionContext } from "../src/ientityfunctioncontext";
import { IOrchestrationFunctionContext } from "../src/iorchestrationfunctioncontext";

// orchestrations
export type OrchestrationHandler = (
    context: IOrchestrationFunctionContext
) => Generator<unknown, unknown, any>;

export interface OrchestrationTrigger extends FunctionTrigger {
    type: "orchestrationTrigger";
}

// entities
export type EntityHandler<T> = (context: IEntityFunctionContext<T>) => void;

export interface EntityTrigger extends FunctionTrigger {
    type: "entityTrigger";
}

// activities
export type ActivityHandler<T> = FunctionHandler &
    ((context: InvocationContext, input: T) => FunctionResult<any>);

export type ActivityOptions<T> = {
    handler: ActivityHandler<T>;
    extraInputs?: FunctionInput[];
    extraOutputs?: FunctionOutput[];
};

export interface ActivityTrigger extends FunctionTrigger {
    type: "activityTrigger";
}

// clients
export interface DurableClientInput extends FunctionInput {
    type: "orchestrationClient";
}
