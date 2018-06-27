import { expect } from "chai";
import "mocha";
import * as moment from "moment";
import { CallActivityAction, CreateTimerAction, HistoryEvent,
    HistoryEventType, WaitForExternalEventAction } from "../../src/classes";
import { TestHistories } from "../testobjects/testhistories";
import { TestOrchestrations } from "../testobjects/testorchestrations";

describe("Orchestrator", () => {
    it("handles a simple orchestration function (no activity functions)", (done) => {
        const orchestrator = TestOrchestrations.SayHelloInline;
        const name = "World";
        const mockContext = new MockContext({
            context: {
                history: TestHistories.GetOrchestratorStart(
                    "SayHelloInline",
                    moment.utc().toDate(),
                    name),
                input: name,
            },
        });
        orchestrator(mockContext);

        expect(mockContext.doneValue).to.be.deep.equal(
            {
                isDone: true,
                actions: [],
                output: `Hello, ${name}!`,
            },
        );
        done();
    });

    describe("Properties", () => {
        it("updates CurrentUtcDateTime to the most recent OrchestratorStarted timestamp", (done) => {
            const orchestrator = TestOrchestrations.SayHelloSequence;
            const name = "World";
            const startTimestamp = moment.utc().toDate();
            const nextTimestamp = moment(startTimestamp).add(1, "s").toDate();

            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetSayHelloWithActivityReplayOne(
                        "SayHelloWithActivity",
                        startTimestamp,
                        name),
                    input: name,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.df.currentUtcDateTime).to.be.deep.equal(nextTimestamp);
            done();
        });
    });

    describe("callActivityAsync()", () => {
        it("schedules an activity function", (done) => {
            const orchestrator = TestOrchestrations.SayHelloWithActivity;
            const name = "World";
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetOrchestratorStart(
                        "SayHelloWithActivity",
                        moment.utc().toDate(),
                        name),
                    input: name,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                {
                    isDone: false,
                    actions: [
                        [ new CallActivityAction("Hello", name) ],
                    ],
                    output: undefined,
                },
            );
            done();
        });

        it("schedules an activity function with no input", (done) => {
            const orchestrator = TestOrchestrations.CallActivityNoInput;
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetOrchestratorStart(
                        "CallActivityNoInput",
                        moment.utc().toDate()),
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                {
                    isDone: false,
                    actions: [
                        [ new CallActivityAction("ReturnsFour", undefined) ],
                    ],
                    output: undefined,
                },
            );
            done();
        });

        describe("Falsy Input", () => {
            const falsyValues = [ false, 0, "", null, undefined, NaN ];
            falsyValues.forEach((falsyValue) => {
                it(`schedules an activity function with falsy input ${falsyValue}`, (done) => {
                    const orchestrator = TestOrchestrations.SayHelloWithActivity;
                    const mockContext = new MockContext({
                        context: {
                            history: TestHistories.GetOrchestratorStart(
                                "SayHelloWithActivity",
                                moment.utc().toDate(),
                                falsyValue),
                            input: falsyValue,
                        },
                    });

                    orchestrator(mockContext);

                    expect(mockContext.doneValue).to.be.deep.equal(
                        {
                            isDone: false,
                            actions: [
                                [ new CallActivityAction("Hello", falsyValue) ],
                            ],
                            output: undefined,
                        },
                    );
                    done();
                });

                it(`handles a completed activity function with falsy input ${falsyValue}`, (done) => {
                    const orchestrator = TestOrchestrations.SayHelloWithActivity;
                    const mockContext = new MockContext({
                        context: {
                            history: TestHistories.GetSayHelloWithActivityReplayOne(
                                "SayHelloWithActivity",
                                moment.utc().toDate(),
                                falsyValue),
                            input: falsyValue,
                        },
                    });

                    orchestrator(mockContext);

                    expect(mockContext.doneValue).to.be.deep.equal(
                        {
                            isDone: true,
                            actions: [
                                [ new CallActivityAction("Hello", falsyValue) ],
                            ],
                            output: `Hello, ${falsyValue}!`,
                        },
                    );
                    done();
                });
            });
        });

        it("handles a completed activity function", (done) => {
            const orchestrator = TestOrchestrations.SayHelloWithActivity;
            const name = "World";
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetSayHelloWithActivityReplayOne(
                        "SayHelloWithActivity",
                        moment.utc().toDate(),
                        name),
                    input: name,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                {
                    isDone: true,
                    actions: [
                        [ new CallActivityAction("Hello", name) ],
                    ],
                    output: `Hello, ${name}!`,
                },
            );
            done();
        });

        it("handles a completed series of activity functions", (done) => {
            const orchestrator = TestOrchestrations.SayHelloSequence;
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetHelloSequenceReplayFinal(
                        "SayHelloSequence",
                        moment.utc().toDate(),
                    ),
                    input: undefined,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                {
                    isDone: true,
                    actions: [
                        [ new CallActivityAction("Hello", "Tokyo")],
                        [ new CallActivityAction("Hello", "Seattle")],
                        [ new CallActivityAction("Hello", "London")],
                    ],
                    output: [
                        "Hello, Tokyo!",
                        "Hello, Seattle!",
                        "Hello, London!",
                    ],
                },
            );
            done();
        });
    });

    describe("createTimer()", () => {
        it("schedules a timer", (done) => {
            const orchestrator = TestOrchestrations.WaitOnTimer;
            const startMoment = moment.utc();
            const fireAt = startMoment.add(5, "m").toDate();

            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetOrchestratorStart(
                        "WaitOnTimer",
                        startMoment.toDate(),
                    ),
                    input: fireAt,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                {
                    isDone: false,
                    actions: [
                        [ new CreateTimerAction(fireAt) ],
                    ],
                    output: undefined,
                },
            );
            done();
        });

        it("proceeds after a timer fires", (done) => {
            const orchestrator = TestOrchestrations.WaitOnTimer;
            const startTimestamp = moment.utc().toDate();
            const fireAt = moment(startTimestamp).add(5, "m").toDate();

            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetWaitOnTimerFired(
                        startTimestamp,
                        fireAt,
                    ),
                    input: fireAt,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                {
                    isDone: true,
                    actions: [
                        [ new CreateTimerAction(fireAt) ],
                    ],
                    output: "Timer fired!",
                },
            );
            done();
        });
    });

    describe("waitForExternalEvent()", () => {
        it("waits for an external event", (done) => {
            const orchestrator = TestOrchestrations.WaitForExternalEvent;
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetOrchestratorStart(
                        "WaitForExternalEvent,",
                        moment.utc().toDate(),
                    ),
                    input: undefined,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.deep.equal(
                {
                    isDone: false,
                    actions: [
                        [ new WaitForExternalEventAction("start") ],
                    ],
                    output: undefined,
                },
            );
            done();
        });

        it("proceeds when the correctly-named event is received", (done) => {
            const orchestrator = TestOrchestrations.WaitForExternalEvent;
            const name = "Reykjavik";
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetWaitForExternalEventEventReceived(
                        moment.utc().toDate(),
                        "start",
                        name,
                    ),
                    input: undefined,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.deep.equal(
                {
                    isDone: false,
                    actions: [
                        [ new WaitForExternalEventAction("start") ],
                        [ new CallActivityAction("Hello", name) ],
                    ],
                    output: undefined,
                },
            );
            done();
        });

        it("does not proceed when an incorrectly-named event is received", (done) => {
            const orchestrator = TestOrchestrations.WaitForExternalEvent;
            const name = "Reykjavik";
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetWaitForExternalEventEventReceived(
                        moment.utc().toDate(),
                        "wrongEvent",
                        name,
                    ),
                    input: undefined,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.deep.equal(
                {
                    isDone: false,
                    actions: [
                        [ new WaitForExternalEventAction("start") ],
                    ],
                    output: undefined,
                },
            );
            done();
        });
    });

    describe("Task.all() and Task.any()", () => {
        it("schedules a parallel set of tasks", (done) => {
            const orchestrator = TestOrchestrations.FanOutFanInDiskUsage;
            const filePaths = ["file1.txt", "file2.png", "file3.csx"];
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetFanOutFanInDiskUsageReplayOne(
                        moment.utc().toDate(),
                        filePaths,
                    ),
                    input: "C:\\Dev",
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                {
                    isDone: false,
                    actions: [
                        [ new CallActivityAction("GetFileList", "C:\\Dev")],
                        filePaths.map((file) => new CallActivityAction("GetFileSize", file)),
                    ],
                    output: undefined,
                },
            );
            done();
        });

        it("Task.all does not proceed if some parallel tasks have completed", (done) => {
            const orchestrator = TestOrchestrations.FanOutFanInDiskUsage;
            const filePaths = ["file1.txt", "file2.png", "file3.csx"];
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetFanOutFanInDiskUsagePartComplete(
                        moment.utc().toDate(),
                        filePaths,
                    ),
                    input: "C:\\Dev",
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                {
                    isDone: false,
                    actions: [
                        [ new CallActivityAction("GetFileList", "C:\\Dev")],
                        filePaths.map((file) => new CallActivityAction("GetFileSize", file)),
                    ],
                    output: undefined,
                },
            );
            done();
        });

        it("Task.all proceeds if all parallel tasks have completed", (done) => {
            const orchestrator = TestOrchestrations.FanOutFanInDiskUsage;
            const filePaths = ["file1.txt", "file2.png", "file3.csx"];
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetFanOutFanInDiskUsageComplete(
                        moment.utc().toDate(),
                        filePaths,
                    ),
                    input: "C:\\Dev",
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                {
                    isDone: true,
                    actions: [
                        [ new CallActivityAction("GetFileList", "C:\\Dev")],
                        filePaths.map((file) => new CallActivityAction("GetFileSize", file)),
                    ],
                    output: 6,
                },
            );
            done();
        });

        it("Task.any proceeds if a scheduled parallel task completes in order", (done) => {
            const orchestrator = TestOrchestrations.AnyAOrB;
            const completeInOrder = true;
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetAnyAOrB(
                        moment.utc().toDate(),
                        completeInOrder,
                    ),
                    input: completeInOrder,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                {
                    isDone: true,
                    actions: [
                        [ new CallActivityAction("TaskA", false), new CallActivityAction("TaskB", true) ],
                    ],
                    output: "A",
                },
            );
            done();
        });

        it("Task.any proceeds if a scheduled parallel task completes in order", (done) => {
            const orchestrator = TestOrchestrations.AnyAOrB;
            const completeInOrder = false;
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetAnyAOrB(
                        moment.utc().toDate(),
                        completeInOrder,
                    ),
                    input: completeInOrder,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                {
                    isDone: true,
                    actions: [
                        [ new CallActivityAction("TaskA", true), new CallActivityAction("TaskB", false) ],
                    ],
                    output: "B",
                },
            );
            done();
        });
    });

    // error propagation

    // instanceid

    // isreplaying

    // call activity retries

    // call suborchestration

    // call suborchestration retries

    // continueasnew

    // custom statuses

    // rewind

    // extended sessions

    // ...
});

class MockContext {
    constructor(
        public bindings: any,
        public df?: any,
        public doneValue?: any,
    ) { }

    public done(err?: any, result?: any) {
        if (err) {
            throw new Error(err);
        } else {
            this.doneValue = result;
        }
    }
}
