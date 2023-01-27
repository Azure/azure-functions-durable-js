import * as df from "durable-functions";
import { ActivityHandler, OrchestrationContext, OrchestrationHandler } from "durable-functions";

const helloActivityName = "sayHello";

const helloSequence: OrchestrationHandler = function* (context: OrchestrationContext) {
    context.log("Starting chain sample");

    const output: string[] = [];
    output.push(yield context.df.callActivity(helloActivityName, "Tokyo"));
    output.push(yield context.df.callActivity(helloActivityName, "Seattle"));
    output.push(yield context.df.callActivity(helloActivityName, "Cairo"));

    return output;
};
df.app.orchestration("helloSequence", helloSequence);

const sayHelloWithActivity: OrchestrationHandler = function* (context: OrchestrationContext) {
    const input: unknown = context.df.getInput();

    const output: string = yield context.df.callActivity(helloActivityName, input);
    return output;
};
df.app.orchestration("sayHelloWithActivity", sayHelloWithActivity);

const sayHelloWithCustomStatus: OrchestrationHandler = function* (context: OrchestrationContext) {
    const input: unknown = context.df.getInput();
    const output: string = yield context.df.callActivity(helloActivityName, input);
    context.df.setCustomStatus(output);
    return output;
};
df.app.orchestration("sayHelloWithCustomStatus", sayHelloWithCustomStatus);

const sayHelloWithSubOrchestrator: OrchestrationHandler = function* (
    context: OrchestrationContext
) {
    const input: unknown = context.df.getInput();

    const output: string = yield context.df.callSubOrchestrator("sayHelloWithActivity", input);
    return output;
};
df.app.orchestration("sayHelloWithSubOrchestrator", sayHelloWithSubOrchestrator);

const helloActivity: ActivityHandler = function (input: unknown): string {
    return `Hello ${input}`;
};
df.app.activity(helloActivityName, {
    handler: helloActivity,
});
