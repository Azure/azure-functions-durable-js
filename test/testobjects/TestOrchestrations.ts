import * as df from "../../src";
import { IOrchestrationFunctionContext } from "../../src/classes";

export class TestOrchestrations {
    public static AnyAOrB: any = df.orchestrator(function*(context: any) {
        const completeInOrder = context.df.getInput();

        const tasks = [];
        tasks.push(context.df.callActivity("TaskA", completeInOrder));
        tasks.push(context.df.callActivity("TaskB", completeInOrder));

        const output = yield context.df.Task.any(tasks);
        return output.result;
    });

    public static AnyAOrBYieldATwice: any = df.orchestrator(function*(context: any) {
        const completeInOrder = context.df.getInput();

        const tasks = [];
        tasks.push(context.df.callActivity("TaskA", completeInOrder));
        tasks.push(context.df.callActivity("TaskB", completeInOrder));
        const output = yield context.df.Task.any(tasks);

        yield tasks[0];
        return output.result;
    });

    public static TimerActivityRace: any = df.orchestrator(function*(context: any) {
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

    public static AnyWithTaskSet: any = df.orchestrator(function*(context: any) {
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

    public static CallActivityNoInput: any = df.orchestrator(function*(context: any) {
       const returnValue = yield context.df.callActivity("ReturnsFour");
       return returnValue;
    });

    public static CallEntitySet: any = df.orchestrator(function*(context: any) {
        const entity = context.df.getInput() as df.EntityId;
        yield context.df.callEntity(entity, "set", "testString");

        return "OK";
    });

    public static CheckForLocksNone: any = df.orchestrator(function*(context: any) {
        return context.df.isLocked();
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

    public static GetAndReleaseLock: any = df.orchestrator(function*(context: any) {
        const entities = context.df.getInput();

        const lock = yield context.df.lock(entities);

        return "ok";
    });

    public static GetLockBadly: any = df.orchestrator(function*(context: any) {
        const locksToGet = context.df.getInput();

        const lock = yield context.df.lock(locksToGet);

        return "ok";
    });

    public static GuidGenerator: any = df.orchestrator(function*(context: any) {
        const outputs: string[] = [];

        for (let i = 0; i < 3; i++) {
            outputs.push(context.df.newGuid());
        }

        return outputs;
    });

    public static PassThrough: any = df.orchestrator(function*(context: any) {
        const input = context.df.getInput();
        return input;
    });

    public static SayHelloInline: any = df.orchestrator(function*(context: any) {
        const input = context.df.getInput();
        return `Hello, ${input}!`;
    });

    public static SayHelloInlineInproperYield: any = df.orchestrator(function*(context: any) {
        const input = yield context.df.getInput();
        return `Hello, ${input}!`;
    });

    public static SayHelloWithActivity: any = df.orchestrator(function*(context: any) {
        const input = context.df.getInput();
        const output = yield context.df.callActivity("Hello", input);
        return output;
    });

    public static SayHelloWithActivityYieldTwice: any = df.orchestrator(function*(context: any) {
        const input = context.df.getInput();
        const task = context.df.callActivity("Hello", input);
        const output = yield task;
        return yield task;
    });

    public static SayHelloWithActivityDirectReturn: any = df.orchestrator(function*(context: any) {
        const input = context.df.getInput();
        return context.df.callActivity("Hello", input);
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

    public static MultipleSubOrchestratorNoSubId: any = df.orchestrator(function*(context: any) {
        const input = context.df.getInput();
        const subOrchName1 = "SayHelloWithActivity";
        const subOrchName2 = "SayHelloInline";
        const output = context.df.callSubOrchestrator(subOrchName1, `${input}_${subOrchName1}_0`);
        const output2 = context.df.callSubOrchestrator(subOrchName2, `${input}_${subOrchName2}_1`);
        const output3 = context.df.callSubOrchestrator(subOrchName1, `${input}_${subOrchName1}_2`);
        const output4 = context.df.callSubOrchestrator(subOrchName2, `${input}_${subOrchName2}_3`);
        return yield context.df.Task.all([output, output2, output3, output4]);
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

    public static SendHttpRequest: any = df.orchestrator(function*(context: IOrchestrationFunctionContext) {
        const input = context.df.getInput() as df.DurableHttpRequest;
        const output = yield context.df.callHttp(
            input.method,
            input.uri,
            input.content,
            input.headers,
            input.tokenSource);
        return output;
    });

    /**
     * This orchestrator and its corresponding history replicate conditions under
     * which there are not sufficient OrchestratorStartedEvents in the history
     * array to satisfy the currentUtcDateTime advancement logic.
     */
    public static TimestampExhaustion: any = df.orchestrator(function*(context: any) {
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

    public static ThrowsExceptionFromActivityWithCatch: any = df.orchestrator(function*(context: any)
    : IterableIterator<unknown> {
        try {
            yield context.df.callActivity("ThrowsErrorActivity");
        } catch (e) {
            const input = context.df.getInput();
            const output = yield context.df.callActivity("Hello", input);

            return output;
        }
    });

    public static ThrowsExceptionInline: any = df.orchestrator(function*(context: any)
    : IterableIterator<unknown> {
        throw Error("Exception from Orchestrator");
    });
}
