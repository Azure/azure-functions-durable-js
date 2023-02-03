import * as df from "../../src";
import { OrchestrationContext } from "../../src";
import { createOrchestrator } from "../../src/shim";

export class TestOrchestrations {
    public static NotGenerator: any = createOrchestrator(function* () {
        return "Hello";
    });

    public static AnyAOrB: any = createOrchestrator(function* (context: any) {
        const completeInOrder = context.df.getInput();

        const tasks = [];
        tasks.push(context.df.callActivity("TaskA", completeInOrder));
        tasks.push(context.df.callActivity("TaskB", completeInOrder));

        const output = yield context.df.Task.any(tasks);
        return output.result;
    });

    public static AnyAOrBYieldATwice: any = createOrchestrator(function* (context: any) {
        const completeInOrder = context.df.getInput();

        const tasks = [];
        tasks.push(context.df.callActivity("TaskA", completeInOrder));
        tasks.push(context.df.callActivity("TaskB", completeInOrder));
        const output = yield context.df.Task.any(tasks);

        yield tasks[0];
        return output.result;
    });

    public static TimerActivityRace: any = createOrchestrator(function* (context: any) {
        const tasks = [];
        const now = new Date(context.df.currentUtcDateTime).getTime();
        const fireAt = new Date(now + 1000);
        tasks.push(context.df.createTimer(fireAt));
        tasks.push(context.df.callActivity("TaskA"));

        const output = yield context.df.Task.any(tasks);

        if (output === tasks[1]) {
            yield context.df.callActivity("TaskB");
        } else if (output === tasks[0]) {
            return "Timer finished";
        } else {
            throw new Error("context.df.Task.any() didn't return a task");
        }

        return output.result;
    });

    public static AnyWithTaskSet: any = createOrchestrator(function* (context: any) {
        const now = new Date(context.df.currentUtcDateTime).getTime();
        const deadline = new Date(now + 300000);
        const timeoutTask = context.df.createTimer(deadline);

        const firstRequiredTask = context.df.waitForExternalEvent("firstRequiredEvent");
        const secondRequiredTask = context.df.waitForExternalEvent("secondRequiredEvent");

        const allRequiredEvents = context.df.Task.all([firstRequiredTask, secondRequiredTask]);

        const winner = yield context.df.Task.any([allRequiredEvents, timeoutTask]);
        const outputs = [];

        if (winner === timeoutTask) {
            // timeout case
            outputs.push("timeout");
        } else {
            // success case
            const okaction = yield context.df.callActivity("Hello", "Tokyo");
            timeoutTask.cancel();
            outputs.push(okaction);
        }
        return outputs;
    });

    public static CallActivityNoInput: any = createOrchestrator(function* (context: any) {
        const returnValue = yield context.df.callActivity("ReturnsFour");
        return returnValue;
    });

    public static CallEntitySet: any = createOrchestrator(function* (context: any) {
        const entity = context.df.getInput() as df.EntityId;
        yield context.df.callEntity(entity, "set", "testString");

        return "OK";
    });

    public static CheckForLocksNone: any = createOrchestrator(function* (context: any) {
        return context.df.isLocked();
    });

    public static ContinueAsNewCounter: any = createOrchestrator(function* (context: any) {
        const currentValueObject = context.df.getInput();
        let currentValue = currentValueObject
            ? currentValueObject.value
                ? currentValueObject.value
                : 0
            : 0;
        currentValue++;

        context.df.continueAsNew({ value: currentValue });

        return currentValue;
    });

    public static FanOutFanInDiskUsage: any = createOrchestrator(function* (context: any) {
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

    public static TaskAllWithNoChildren: any = createOrchestrator(function* (
        context: OrchestrationContext
    ) {
        return yield context.df.Task.all([]);
    });

    public static TaskAnyWithNoChildren: any = createOrchestrator(function* (
        context: OrchestrationContext
    ) {
        return yield context.df.Task.any([]);
    });

    public static GetAndReleaseLock: any = createOrchestrator(function* (context: any) {
        const entities = context.df.getInput();

        yield context.df.lock(entities);

        return "ok";
    });

    public static GetLockBadly: any = createOrchestrator(function* (context: any) {
        const locksToGet = context.df.getInput();

        yield context.df.lock(locksToGet);

        return "ok";
    });

    public static GuidGenerator: any = createOrchestrator(function* (context: any) {
        const outputs: string[] = [];

        for (let i = 0; i < 3; i++) {
            outputs.push(context.df.newGuid());
        }

        return outputs;
    });

    public static PassThrough: any = createOrchestrator(function* (context: any) {
        const input = context.df.getInput();
        return input;
    });

    public static SayHelloInline: any = createOrchestrator(function* (context: any) {
        const input = context.df.getInput();
        return `Hello, ${input}!`;
    });

    public static SayHelloInlineInproperYield: any = createOrchestrator(function* (context: any) {
        const input = yield context.df.getInput();
        return `Hello, ${input}!`;
    });

    public static SayHelloWithActivity: any = createOrchestrator(function* (context: any) {
        const input = context.df.getInput();
        const output = yield context.df.callActivity("Hello", input);
        return output;
    });

    public static SayHelloWithActivityYieldTwice: any = createOrchestrator(function* (
        context: any
    ) {
        const input = context.df.getInput();
        const task = context.df.callActivity("Hello", input);
        yield task;
        yield task;
        return yield task;
    });

    public static SayHelloWithActivityDirectReturn: any = createOrchestrator(function* (
        context: any
    ) {
        const input = context.df.getInput();
        return context.df.callActivity("Hello", input);
    });

    public static SayHelloWithActivityRetry: any = createOrchestrator(function* (context: any) {
        const input = context.df.getInput();
        const retryOptions = new df.RetryOptions(10000, 2);
        const output = yield context.df.callActivityWithRetry("Hello", retryOptions, input);
        return output;
    });

    public static SayHelloWithActivityRetryAndReturnTimestamps: any = createOrchestrator(function* (
        context: any
    ) {
        const input = context.df.getInput();
        const retryOptions = new df.RetryOptions(10000, 2);
        const timestamps = [];
        timestamps.push(context.df.currentUtcDateTime);
        try {
            yield context.df.callActivityWithRetry("Hello", retryOptions, input);
        } catch {
            // pass
        }
        timestamps.push(context.df.currentUtcDateTime);
        return timestamps;
    });

    public static SayHelloWithActivityRetryFanout: any = createOrchestrator(function* (
        context: any
    ) {
        const tasks = [];
        const retryOptions = new df.RetryOptions(100, 5);
        tasks.push(context.df.callActivityWithRetry("Hello", retryOptions, "Tokyo"));
        tasks.push(context.df.callActivityWithRetry("Hello", retryOptions, "Seattle"));
        return yield context.df.Task.all(tasks);
    });

    public static SayHelloWithActivityRetryNoOptions: any = createOrchestrator(function* (
        context: any
    ) {
        const output = yield context.df.callActivityWithRetry("Hello", undefined, "World");
        return output;
    });

    public static SayHelloWithCustomStatus: any = createOrchestrator(function* (context: any) {
        const output = [];

        output.push(yield context.df.callActivity("Hello", "Tokyo"));
        context.df.setCustomStatus("Tokyo");
        output.push(yield context.df.callActivity("Hello", "Seattle"));
        context.df.setCustomStatus("Seattle");
        output.push(yield context.df.callActivity("Hello", "London"));
        context.df.setCustomStatus("London");

        return output;
    });

    public static SayHelloWithSubOrchestrator: any = createOrchestrator(function* (context: any) {
        const input = context.df.getInput();
        const childId = context.df.instanceId + ":0";
        const output = yield context.df.callSubOrchestrator("SayHelloWithActivity", input, childId);
        return output;
    });

    public static SayHelloWithSubOrchestratorNoSubId: any = createOrchestrator(function* (
        context: any
    ) {
        const input = context.df.getInput();
        const output = yield context.df.callSubOrchestrator("SayHelloWithActivity", input);
        return output;
    });

    public static MultipleSubOrchestratorNoSubId: any = createOrchestrator(function* (
        context: any
    ) {
        const input = context.df.getInput();
        const subOrchName1 = "SayHelloWithActivity";
        const subOrchName2 = "SayHelloInline";
        const output = context.df.callSubOrchestrator(subOrchName1, `${input}_${subOrchName1}_0`);
        const output2 = context.df.callSubOrchestrator(subOrchName2, `${input}_${subOrchName2}_1`);
        const output3 = context.df.callSubOrchestrator(subOrchName1, `${input}_${subOrchName1}_2`);
        const output4 = context.df.callSubOrchestrator(subOrchName2, `${input}_${subOrchName2}_3`);
        return yield context.df.Task.all([output, output2, output3, output4]);
    });

    public static SayHelloWithSubOrchestratorRetry: any = createOrchestrator(function* (
        context: any
    ) {
        const input = context.df.getInput();
        const childId = context.df.instanceId + ":0";
        const retryOptions = new df.RetryOptions(10000, 2);
        const output = yield context.df.callSubOrchestratorWithRetry(
            "SayHelloInline",
            retryOptions,
            input,
            childId
        );
        return output;
    });

    public static SayHelloWithSubOrchestratorRetryFanout: any = createOrchestrator(function* (
        context: any
    ) {
        const retryOptions = new df.RetryOptions(100, 5);
        const output = [];
        output.push(
            context.df.callSubOrchestratorWithRetry("SayHelloInline", retryOptions, "Tokyo")
        );
        output.push(
            context.df.callSubOrchestratorWithRetry("SayHelloInline", retryOptions, "Seattle")
        );
        return yield context.df.Task.all(output);
    });

    public static SayHelloWithSubOrchestratorRetryNoOptions: any = createOrchestrator(function* (
        context: any
    ) {
        const childId = context.df.instanceId + ":0";
        const output = yield context.df.callSubOrchestratorWithRetry(
            "SayHelloInline",
            undefined,
            "World",
            childId
        );
        return output;
    });

    public static SayHelloSequence: any = createOrchestrator(function* (context: any) {
        const output = [];

        output.push(yield context.df.callActivity("Hello", "Tokyo"));
        output.push(yield context.df.callActivity("Hello", "Seattle"));
        output.push(yield context.df.callActivity("Hello", "London"));

        return output;
    });

    public static SendHttpRequest: any = createOrchestrator(function* (context) {
        const input = context.df.getInput() as df.DurableHttpRequest;
        const output = yield context.df.callHttp({
            method: input.method,
            url: input.uri,
            body: input.content,
            headers: input.headers,
            tokenSource: input.tokenSource,
            asynchronousPatternEnabled: input.asynchronousPatternEnabled,
        });
        return output;
    });

    /**
     * This orchestrator and its corresponding history replicate conditions under
     * which there are not sufficient OrchestratorStartedEvents in the history
     * array to satisfy the currentUtcDateTime advancement logic.
     */
    public static TimestampExhaustion: any = createOrchestrator(function* (context: any) {
        const payload = context.df.getInput();

        yield context.df.callActivity("Merge");

        if (payload.delayMergeUntilSecs) {
            const now = new Date(context.df.currentUtcDateTime).getTime();
            const fireAt = new Date(now + payload.delayMergeUntilSecs * 1000);
            yield context.df.createTimer(fireAt);
        }

        let x = 0;
        do {
            const result = yield context.df.callActivity("CheckIfMerged");
            const hasMerged = result.output;

            if (hasMerged) {
                return "Merge successful";
            } else {
                yield context.df.waitForExternalEvent("CheckPrForMerge");
            }

            x++;
        } while (x < 10);
    });

    public static WaitForExternalEvent: any = createOrchestrator(function* (context: any) {
        const name = yield context.df.waitForExternalEvent("start");

        const returnValue = yield context.df.callActivity("Hello", name);

        return returnValue;
    });

    public static WaitOnTimer: any = createOrchestrator(function* (context: any) {
        const fireAt = context.df.getInput();

        yield context.df.createTimer(fireAt);

        return "Timer fired!";
    });

    public static ThrowsExceptionFromActivity = createOrchestrator(function* (context) {
        yield context.df.callActivity("ThrowsErrorActivity");
    });

    public static ThrowsExceptionFromActivityWithCatch = createOrchestrator(function* (context) {
        try {
            yield context.df.callActivity("ThrowsErrorActivity");
        } catch (e) {
            const input = context.df.getInput();
            const output = yield context.df.callActivity("Hello", input);

            return output;
        }
    });

    public static ThrowsExceptionInline: any = createOrchestrator(function* () {
        throw Error("Exception from Orchestrator");
    });
}
