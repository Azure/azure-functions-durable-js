import {
    FunctionHandler,
    FunctionInput,
    FunctionOptions,
    FunctionOutput,
    FunctionTrigger,
} from "@azure/functions";

export type ActivityHandler = FunctionHandler;

export interface ActivityOptions extends Partial<FunctionOptions> {
    handler: ActivityHandler;
    extraInputs?: FunctionInput[];
    extraOutputs?: FunctionOutput[];
}

export interface ActivityTrigger extends FunctionTrigger {
    type: "activityTrigger";
}
