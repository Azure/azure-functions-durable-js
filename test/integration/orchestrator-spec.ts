import { expect } from "chai";
import "mocha";
import * as moment from "moment";
import {
    CallActivityAction, CreateTimerAction, HistoryEvent,
    HistoryEventType, OrchestratorState, WaitForExternalEventAction,
    } from "../../src/classes";
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
            new OrchestratorState(true, [], `Hello, ${name}!`),
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

    describe("Error Handling", () => {
        it("throws an exception orchestrator function throws and doesn't handle", (done) => {
            expect(() => {
                const orchestrator = TestOrchestrations.ThrowsError();
                const mockContext = new MockContext({
                    context: {
                        history: TestHistories.GetOrchestratorStart(
                            "ThrowsError",
                            moment.utc().toDate(),
                        ),
                    },
                });

                orchestrator(mockContext);
            }).to.throw();
            done();
        });

        it("throws an exception activity function throws and orchestrator function doesn't handle", (done) => {
            expect(() => {
                const orchestrator = TestOrchestrations.ThrowsExceptionFromActivity();
                const mockContext =  new MockContext({
                    context: {
                        history: TestHistories.GetThrowsExceptionFromActivityReplayOne(
                            moment.utc().toDate(),
                        ),
                    },
                });

                orchestrator(mockContext);
            }).to.throw();
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
                new OrchestratorState(
                    false,
                    [
                        [ new CallActivityAction("Hello", name) ],
                    ],
                    undefined,
                ),
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
                new OrchestratorState(
                    false,
                    [
                        [ new CallActivityAction("ReturnsFour") ],
                    ],
                    undefined,
                ),
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
                        new OrchestratorState(
                            false,
                            [
                                [ new CallActivityAction("Hello", falsyValue) ],
                            ],
                            undefined,
                        ),
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
                        new OrchestratorState(
                            true,
                            [
                                [ new CallActivityAction("Hello", falsyValue) ],
                            ],
                            `Hello, ${falsyValue}!`,
                        ),
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
                new OrchestratorState(
                    true,
                    [
                        [ new CallActivityAction("Hello", name) ],
                    ],
                    `Hello, ${name}!`,
                ),
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
                new OrchestratorState(
                    true,
                    [
                        [ new CallActivityAction("Hello", "Tokyo")],
                        [ new CallActivityAction("Hello", "Seattle")],
                        [ new CallActivityAction("Hello", "London")],
                    ],
                    [
                        "Hello, Tokyo!",
                        "Hello, Seattle!",
                        "Hello, London!",
                    ],
                ),
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
                new OrchestratorState(
                    false,
                    [
                        [ new CreateTimerAction(fireAt) ],
                    ],
                    undefined,
                ),
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
                new OrchestratorState(
                    true,
                    [
                        [ new CreateTimerAction(fireAt) ],
                    ],
                    "Timer fired!",
                ),
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
                new OrchestratorState(
                    false,
                    [
                        [ new WaitForExternalEventAction("start") ],
                    ],
                    undefined,
                ),
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
                new OrchestratorState(
                    false,
                    [
                        [ new WaitForExternalEventAction("start") ],
                        [ new CallActivityAction("Hello", name) ],
                    ],
                    undefined,
                ),
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
                new OrchestratorState(
                    false,
                    [
                        [ new WaitForExternalEventAction("start") ],
                    ],
                    undefined,
                ),
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
                new OrchestratorState(
                    false,
                    [
                        [ new CallActivityAction("GetFileList", "C:\\Dev")],
                        filePaths.map((file) => new CallActivityAction("GetFileSize", file)),
                    ],
                    undefined,
                ),
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
                new OrchestratorState(
                    false,
                    [
                        [ new CallActivityAction("GetFileList", "C:\\Dev")],
                        filePaths.map((file) => new CallActivityAction("GetFileSize", file)),
                    ],
                    undefined,
                ),
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
                new OrchestratorState(
                    true,
                    [
                        [ new CallActivityAction("GetFileList", "C:\\Dev")],
                        filePaths.map((file) => new CallActivityAction("GetFileSize", file)),
                    ],
                    6,
                ),
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
                new OrchestratorState(
                    true,
                    [
                        [ new CallActivityAction("TaskA", false), new CallActivityAction("TaskB", true) ],
                    ],
                    "A",
                ),
            );
            done();
        });

        it("Task.any proceeds if a scheduled parallel task completes out of order", (done) => {
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
                new OrchestratorState(
                    true,
                    [
                        [ new CallActivityAction("TaskA", true), new CallActivityAction("TaskB", false) ],
                    ],
                    "B",
                ),
            );
            done();
        });
    });

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
