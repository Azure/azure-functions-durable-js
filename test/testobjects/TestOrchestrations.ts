import * as df from "../../src";

export class TestOrchestrations {
    public static AnyAOrB: any = df.orchestrator(function*(context: any) {
        const completeInOrder = context.df.getInput();

        const tasks = [];
        tasks.push(context.df.callActivity("TaskA", !completeInOrder));
        tasks.push(context.df.callActivity("TaskB", completeInOrder));

        const output = yield context.df.Task.any(tasks);
        return output.result;
    });

    public static CallActivityNoInput: any = df.orchestrator(function*(context: any) {
       const returnValue = yield context.df.callActivity("ReturnsFour");
       return returnValue;
    });

    public static ContinueAsNewCounter: any = df.orchestrator(function*(context: any) {
        const currentValueObject = context.df.getInput();
        let currentValue = currentValueObject
            ? currentValueObject.value
                ? currentValueObject.value
                : 0
            : 0;
        currentValue++;

        yield context.df.continueAsNew({ value: currentValue });

        return currentValue;
    });

    public static FanOutFanInDiskUsage: any = df.orchestrator(function*(context: any) {
        const directory = context.df.getInput();
        const files = yield context.df.callActivity("GetFileList", directory);

        const tasks = [];
        for (const file of files) {
            tasks.push(context.df.callActivity("GetFileSize", file));
        }

        const results = yield context.df.Task.all(tasks);
        const totalBytes = results.reduce((prev: any, curr: any) => prev + curr, 0);

        return totalBytes;
    });

    public static SayHelloInline: any = df.orchestrator(function*(context: any) {
        const input = context.df.getInput();
        return `Hello, ${input}!`;
    });

    public static SayHelloWithActivity: any = df.orchestrator(function*(context: any) {
        const input = context.df.getInput();
        const output = yield context.df.callActivity("Hello", input);
        return output;
    });

    public static SayHelloWithActivityRetry: any = df.orchestrator(function*(context: any) {
        const input = context.df.getInput();
        const retryOptions = new df.RetryOptions(10000, 2);
        const output = yield context.df.callActivityWithRetry("Hello", retryOptions, input);
        return output;
    });

    public static SayHelloWithActivityRetryNoOptions: any = df.orchestrator(function*(context: any) {
        const output = yield context.df.callActivityWithRetry("Hello", undefined, "World");
        return output;
    });

    public static SayHelloWithCustomStatus: any = df.orchestrator(function*(context: any) {
        const output = [];

        output.push(yield context.df.callActivity("Hello", "Tokyo"));
        context.df.setCustomStatus("Tokyo");
        output.push(yield context.df.callActivity("Hello", "Seattle"));
        context.df.setCustomStatus("Seattle");
        output.push(yield context.df.callActivity("Hello", "London"));
        context.df.setCustomStatus("London");

        return output;
    });

    public static SayHelloWithSubOrchestrator: any = df.orchestrator(function*(context: any) {
        const input = context.df.getInput();
        const childId = context.df.instanceId + ":0";
        const output = yield context.df.callSubOrchestrator("SayHelloWithActivity", input, childId);
        return output;
    });

    public static SayHelloWithSubOrchestratorNoSubId: any = df.orchestrator(function*(context: any) {
        const input = context.df.getInput();
        const output = yield context.df.callSubOrchestrator("SayHelloWithActivity", input);
        return output;
    });

    public static SayHelloWithSubOrchestratorRetry: any = df.orchestrator(function*(context: any) {
        const input = context.df.getInput();
        const childId = context.df.instanceId + ":0";
        const retryOptions = new df.RetryOptions(10000, 2);
        const output = yield context.df.callSubOrchestratorWithRetry("SayHelloInline", retryOptions, input, childId);
        return output;
    });

    public static SayHelloWithSubOrchestratorRetryNoOptions: any = df.orchestrator(function*(context: any) {
        const childId = context.df.instanceId + ":0";
        const output = yield context.df.callSubOrchestratorWithRetry("SayHelloInline", undefined, "World", childId);
        return output;
    });

    public static SayHelloSequence: any = df.orchestrator(function*(context: any) {
        const output = [];

        output.push(yield context.df.callActivity("Hello", "Tokyo"));
        output.push(yield context.df.callActivity("Hello", "Seattle"));
        output.push(yield context.df.callActivity("Hello", "London"));

        return output;
    });

    public static WaitForExternalEvent: any = df.orchestrator(function*(context: any) {
        const name = yield context.df.waitForExternalEvent("start");

        const returnValue = yield context.df.callActivity("Hello", name);

        return returnValue;
    });

    public static WaitOnTimer: any = df.orchestrator(function*(context: any) {
        const fireAt = context.df.getInput();

        yield context.df.createTimer(fireAt);

        return "Timer fired!";
    });

    public static ThrowsExceptionFromActivity: any = df.orchestrator(function*(context: any)
    : IterableIterator<unknown> {
        yield context.df.callActivity("ThrowsErrorActivity");
    });

    public static ThrowsExceptionInline: any = df.orchestrator(function*(context: any)
    : IterableIterator<unknown> {
        throw Error("Exception from Orchestrator");
    });
}
