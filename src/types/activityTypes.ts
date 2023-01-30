import {
    FunctionHandler,
    FunctionInput,
    FunctionOptions,
    FunctionOutput,
    FunctionTrigger,
} from "@azure/functions";
import { RetryOptions } from "./";
import { Task } from "./taskTypes";

export type ActivityHandler = FunctionHandler;

export interface ActivityOptions extends Partial<FunctionOptions> {
    handler: ActivityHandler;
    extraInputs?: FunctionInput[];
    extraOutputs?: FunctionOutput[];
}

export interface ActivityTrigger extends FunctionTrigger {
    type: "activityTrigger";
}

export type CallableActivity = (options?: CallActivityOptions) => Task;

export interface CallActivityOptions {
    input?: unknown;
    retryOptions?: RetryOptions;
}
