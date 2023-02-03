import { InvocationContext } from "@azure/functions";
import * as df from "durable-functions";
import {
    ActivityHandler,
    OrchestrationContext,
    OrchestrationHandler,
    RetryOptions,
} from "durable-functions";

const callActivityWithRetry: OrchestrationHandler = function* (context: OrchestrationContext) {
    const retryOptions: RetryOptions = new df.RetryOptions(1000, 2);

    let returnValue: any;
    try {
        returnValue = yield context.df.callActivityWithRetry("flakyFunction", retryOptions);
    } catch (e) {
        context.log("Orchestrator caught exception. Flaky function is extremely flaky.");
    }

    return returnValue;
};
df.app.orchestration("callActivityWithRetry", callActivityWithRetry);

const flakyFunction: ActivityHandler = function (_input: any, context: InvocationContext): void {
    context.log("Flaky Function Flaking!");
    throw new Error("FlakyFunction flaked");
};
df.app.activity("flakyFunction", {
    handler: flakyFunction,
});
