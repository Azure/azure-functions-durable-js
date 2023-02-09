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

/**
 * The result of `df.app.activity()`
 *
 * This can be passed to `context.df.callActivity()`
 * or `context.df.callActivityWithRetry()` in orchestrations.
 *
 */
export interface RegisteredActivity {
    /**
     * The name of the Activty function to call
     */
    name: string;
}
