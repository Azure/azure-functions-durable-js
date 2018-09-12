import * as df from "../../src";

export class TestOrchestrations {
    public static AnyAOrB: any = (df as any)(function*(context: any) {
        const completeInOrder = context.df.getInput();

        const tasks = [];
        tasks.push(context.df.callActivity("TaskA", !completeInOrder));
        tasks.push(context.df.callActivity("TaskB", completeInOrder));

        const output = yield context.df.Task.any(tasks);
        return output.result;
    });

    public static CallActivityNoInput: any = (df as any)(function*(context: any) {
       const returnValue = yield context.df.callActivity("ReturnsFour");
       return returnValue;
    });

    public static FanOutFanInDiskUsage: any = (df as any)(function*(context: any) {
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

    public static SayHelloInline: any = (df as any)(function*(context: any) {
        const input = context.df.getInput();
        return `Hello, ${input}!`;
    });

    public static SayHelloWithActivity: any = (df as any)(function*(context: any) {
        const input = context.df.getInput();
        const output = yield context.df.callActivity("Hello", input);
        return output;
    });

    public static SayHelloWithSubOrchestrator: any = (df as any)(function*(context: any) {
        const input = context.df.getInput();
        const childId = context.df.instanceId + ":0";
        const output = yield context.df.callSubOrchestrator("SayHelloWithActivity", input, childId);
        return output;
    });

    public static SayHelloWithSubOrchestratorNoSubId: any = (df as any)(function*(context: any) {
        const input = context.df.getInput();
        const output = yield context.df.callSubOrchestrator("SayHelloWithActivity", input);
        return output;
    });

    public static SayHelloSequence: any = (df as any)(function*(context: any) {
        const output = [];

        output.push(yield context.df.callActivity("Hello", "Tokyo"));
        output.push(yield context.df.callActivity("Hello", "Seattle"));
        output.push(yield context.df.callActivity("Hello", "London"));

        return output;
    });

    public static WaitForExternalEvent: any = (df as any)(function*(context: any) {
        const name = yield context.df.waitForExternalEvent("start");

        const returnValue = yield context.df.callActivity("Hello", name);

        return returnValue;
    });

    public static WaitOnTimer: any = (df as any)(function*(context: any) {
        const fireAt = context.df.getInput();

        yield context.df.createTimer(fireAt);

        return "Timer fired!";
    });

    public static ThrowsExceptionFromActivity: any = () => {
        (df as any)(function*(context: any): IterableIterator<any> {
            yield context.df.callActivity("ThrowsErrorActivity");
        });
    }

    public static ThrowsError: any = () => {
        (df as any)(function*(context: any): IterableIterator<any> {
            throw Error("Exception from Orchestrator");
        });
    }
}
