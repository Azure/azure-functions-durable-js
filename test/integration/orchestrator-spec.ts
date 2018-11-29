import { expect } from "chai";
import "mocha";
import * as moment from "moment";
import * as uuidv1 from "uuid/v1";
import {
    CallActivityAction, CallActivityWithRetryAction, CallSubOrchestratorAction,
    CallSubOrchestratorWithRetryAction, ContinueAsNewAction, CreateTimerAction,
    IDurableOrchestrationContext, IOrchestratorState, OrchestratorState,
    RetryOptions, WaitForExternalEventAction,
} from "../../src/classes";
import { TestHistories } from "../testobjects/testhistories";
import { TestOrchestrations } from "../testobjects/testorchestrations";

describe("Orchestrator", () => {
    it("handles a simple orchestration function (no activity functions)", async () => {
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
            new OrchestratorState({
                isDone: true,
                actions: [],
                output: `Hello, ${name}!`,
            }),
        );
    });

    describe("Properties", () => {
        it("assigns instanceId", async () => {
            const orchestrator = TestOrchestrations.SayHelloInline;
            const name = "World";
            const id = uuidv1();
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetOrchestratorStart(
                        "SayHelloInline",
                        moment.utc().toDate(),
                        name),
                    input: name,
                    instanceId: id,
                },
            });
            orchestrator(mockContext);

            expect(mockContext.df.instanceId).to.be.equal(id);
        });

        it("assigns isReplaying", async () => {
            const orchestrator = TestOrchestrations.SayHelloSequence;
            const name = "World";
            const replaying = true;

            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetSayHelloWithActivityReplayOne(
                        "SayHelloWithActivity",
                        moment.utc().toDate(),
                        name),
                    input: name,
                    isReplaying: replaying,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.df.isReplaying).to.be.equal(replaying);
        });

        it("assigns parentInstanceId", async () => {
            const orchestrator = TestOrchestrations.SayHelloSequence;
            const name = "World";
            const id = uuidv1();

            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetSayHelloWithActivityReplayOne(
                        "SayHelloWithActivity",
                        moment.utc().toDate(),
                        name),
                    input: name,
                    parentInstanceId: id,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.df.parentInstanceId).to.be.equal(id);
        });

        it("updates currentUtcDateTime to the most recent OrchestratorStarted timestamp", async () => {
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
        });
    });

    describe("Error Handling", () => {
        it("reports an unhandled exception from orchestrator", async () => {
            const orchestrator = TestOrchestrations.ThrowsExceptionInline;
            const mockContext =  new MockContext({
                context: {
                    history: TestHistories.GetOrchestratorStart(
                        "ThrowsExceptionInline",
                        moment.utc().toDate(),
                    ),
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.an("object").that.deep.include({
                isDone: false,
                actions: [],
            });
            expect(mockContext.doneValue.error).to.include("Exception from Orchestrator");
        });

        it("reports an unhandled exception from activity passed through orchestrator", async () => {
            const orchestrator = TestOrchestrations.ThrowsExceptionFromActivity;
            const mockContext =  new MockContext({
                context: {
                    history: TestHistories.GetThrowsExceptionFromActivityReplayOne(
                        moment.utc().toDate(),
                    ),
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.an("object").that.deep.include({
                isDone: false,
                actions:
                [
                    [ new CallActivityAction("ThrowsErrorActivity") ],
                ],
            });
            expect(mockContext.doneValue.error).to.include("Activity function 'ThrowsErrorActivity' failed.");
        });

        it("schedules an activity function after orchestrator catches an exception", async () => {
            const orchestrator = TestOrchestrations.ThrowsExceptionFromActivityWithCatch;
            const name = "World";
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetThrowsExceptionFromActivityReplayOne(
                        moment.utc().toDate(),
                    ),
                    input: name,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    actions:
                    [
                        [ new CallActivityAction("ThrowsErrorActivity")],
                        [ new CallActivityAction("Hello", name) ],
                    ],
                }),
            );
        });
    });

    describe("callActivity()", () => {
        it("schedules an activity function", async () => {
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
                new OrchestratorState({
                    isDone: false,
                    actions:
                    [
                        [ new CallActivityAction("Hello", name) ],
                    ],
                }),
            );
        });

        it("schedules an activity function with no input", async () => {
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
                new OrchestratorState({
                    isDone: false,
                    actions:
                    [
                        [ new CallActivityAction("ReturnsFour") ],
                    ],
                }),
            );
        });

        describe("Falsy Input", () => {
            const falsyValues = [ false, 0, "", null, undefined, NaN ];
            falsyValues.forEach((falsyValue) => {
                it(`schedules an activity function with falsy input ${falsyValue}`, async () => {
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
                        new OrchestratorState({
                            isDone: false,
                            actions:
                            [
                                [ new CallActivityAction("Hello", falsyValue) ],
                            ],
                        }),
                    );
                });

                it(`handles a completed activity function with falsy input ${falsyValue}`, async () => {
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
                        new OrchestratorState({
                            isDone: true,
                            actions:
                            [
                                [ new CallActivityAction("Hello", falsyValue) ],
                            ],
                            output: `Hello, ${falsyValue}!`,
                        }),
                    );
                });
            });
        });

        it("handles a completed activity function", async () => {
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
                new OrchestratorState({
                    isDone: true,
                    actions:
                    [
                        [ new CallActivityAction("Hello", name) ],
                    ],
                    output: `Hello, ${name}!`,
                }),
            );
        });

        it("handles a completed series of activity functions", async () => {
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
                new OrchestratorState({
                    isDone: true,
                    actions:
                    [
                        [ new CallActivityAction("Hello", "Tokyo")],
                        [ new CallActivityAction("Hello", "Seattle")],
                        [ new CallActivityAction("Hello", "London")],
                    ],
                    output:
                    [
                        "Hello, Tokyo!",
                        "Hello, Seattle!",
                        "Hello, London!",
                    ],
                }),
            );
        });
    });

    describe("callActivityWithRetry()", () => {
        it("reports an error when retryOptions is undefined", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithActivityRetryNoOptions;
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetOrchestratorStart(
                        "SayHelloWithActivityRetryOptionsUndefined",
                        moment.utc().toDate()),
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.an("object").that.deep.include(
                new OrchestratorState({
                    isDone: false,
                    actions: [],
                }),
            );
            expect(mockContext.doneValue.error).to
                .include("retryOptions: expected type RetryOptions but got undefined");
        });

        it("schedules an activity function", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithActivityRetry;
            const name = "World";
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetOrchestratorStart(
                        "SayHelloWithActivityRetry",
                        moment.utc().toDate(),
                        name),
                    input: name,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    actions:
                    [
                        [
                            new CallActivityWithRetryAction(
                                "Hello",
                                new RetryOptions(10000, 2),
                                name),
                        ],
                    ],
                }),
            );
        });

        it("schedules an activity funtion if < max attempts", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithActivityRetry;
            const name = "World";
            const retryOptions = new RetryOptions(10000, 2);
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetSayHelloWithActivityRetryRetryOne(
                        moment.utc().toDate(),
                        name,
                        retryOptions.firstRetryIntervalInMilliseconds),
                    input: name,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    actions:
                    [
                        [
                            new CallActivityWithRetryAction(
                                "Hello",
                                retryOptions,
                                name),
                        ],
                    ],
                }),
            );
        });

        it("retries a failed activity function if < max attempts", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithActivityRetry;
            const name = "World";
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetSayHelloWithActivityRetryFailOne(
                        moment.utc().toDate(),
                        name),
                    input: name,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    actions: [
                        [
                            new CallActivityWithRetryAction(
                                "Hello",
                                new RetryOptions(10000, 2),
                                name),
                        ],
                    ],
                }),
            );
        });

        it("reports a failed activity function if >= max attempts", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithActivityRetry;
            const name = "World";
            const retryOptions = new RetryOptions(10000, 2);
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetSayHelloWithActivityRetryRetryTwo(
                        moment.utc().toDate(),
                        name,
                        retryOptions.firstRetryIntervalInMilliseconds),
                    input: name,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.an("object").that.deep.include({
                isDone: false,
                actions:
                [
                    [
                        new CallActivityWithRetryAction(
                            "Hello",
                            retryOptions,
                            name),
                    ],
                ],
            });
            expect(mockContext.doneValue.error).to
                .include("Activity function 'Hello' failed: Result: Failure");
        });

        it("handles a completed activity function", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithActivityRetry;
            const name = "World";
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetSayHelloWithActivityReplayOne(
                        "SayHelloWithActivityRetry",
                        moment.utc().toDate(),
                        name),
                    input: name,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: true,
                    actions:
                    [
                        [
                            new CallActivityWithRetryAction(
                                "Hello",
                                new RetryOptions(10000, 2),
                                name),
                        ],
                    ],
                    output: `Hello, ${name}!`,
                }),
            );
        });
    });

    describe("callSubOrchestrator()", () => {
        it("schedules a suborchestrator function", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithSubOrchestrator;
            const name = "World";
            const id = uuidv1();
            const childId = `${id}:0`;
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetOrchestratorStart(
                        "SayHelloWithSubOrchestrator",
                        moment.utc().toDate(),
                    ),
                    input: name,
                    instanceId: id,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    actions:
                    [
                        [ new CallSubOrchestratorAction("SayHelloWithActivity", childId, name) ],
                    ],
                }),
            );
        });

        it("schedules a suborchestrator function with no instanceId", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithSubOrchestratorNoSubId;
            const name = "World";
            const id = uuidv1();
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetOrchestratorStart(
                        "SayHelloWithSubOrchestrator",
                        moment.utc().toDate(),
                    ),
                    input: name,
                    instanceId: id,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    actions:
                    [
                        [ new CallSubOrchestratorAction("SayHelloWithActivity", undefined, name) ],
                    ],
                }),
            );
        });

        it("handles a completed suborchestrator function", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithSubOrchestrator;
            const name = "World";
            const id = uuidv1();
            const childId = `${id}:0`;
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetSayHelloWithSubOrchestratorReplayOne(
                        moment.utc().toDate(),
                        "SayHelloWithSubOrchestrator",
                        "SayHelloWithActivity",
                        childId,
                        name,
                    ),
                    input: name,
                    instanceId: id,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: true,
                    actions:
                    [
                        [ new CallSubOrchestratorAction("SayHelloWithActivity", childId, name) ],
                    ],
                    output: "Hello, World!",
                }),
            );
        });

        it("reports an unhandled exception from suborchestrator", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithSubOrchestrator;
            const name = "World";
            const id = uuidv1();
            const childId = `${id}:0`;
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetSayHelloWithSubOrchestratorFail(
                        moment.utc().toDate(),
                        "SayHelloWithSubOrchestrator",
                        "SayHelloWithActivity",
                        childId,
                        name,
                    ),
                    input: name,
                    instanceId: id,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.an("object").that.deep.include({
                isDone: false,
                actions:
                [
                    [ new CallSubOrchestratorAction("SayHelloWithActivity", childId, name) ],
                ],
            });
            expect(mockContext.doneValue.error).to
                .include("Sub orchestrator function 'SayHelloInline' failed: Result: Failure");
        });
    });

    describe("callSubOrchestratorWithRetry()", () => {
        it("reports an error when retryOptions is undefined", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithSubOrchestratorRetryNoOptions;
            const id = uuidv1();
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetOrchestratorStart(
                        "SayHelloWithSubOrchestratorRetryNoOptions",
                        moment.utc().toDate()),
                    instanceId: id,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.an("object").that.deep.include({
                isDone: false,
                actions: [],
            });
            expect(mockContext.doneValue.error).to
                .include("retryOptions: expected type RetryOptions but got undefined");
        });

        it("schedules a suborchestrator function", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithSubOrchestratorRetry;
            const name = "World";
            const id = uuidv1();
            const childId = `${id}:0`;
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetOrchestratorStart(
                        "SayHelloWithSubOrchestratorRetry",
                        moment.utc().toDate(),
                        name),
                    input: name,
                    instanceId: id,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    actions:
                    [
                        [
                            new CallSubOrchestratorWithRetryAction(
                                "SayHelloInline",
                                new RetryOptions(10000, 2),
                                name,
                                childId,
                            ),
                        ],
                    ],
                }),
            );
        });

        it("schedules a suborchestrator function if < max attempts", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithSubOrchestratorRetry;
            const name = "World";
            const id = uuidv1();
            const childId = `${id}:0`;
            const retryOptions = new RetryOptions(10000, 2);
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetSayHelloWithSubOrchestratorRetryRetryOne(
                        moment.utc().toDate(),
                        childId,
                        name,
                        retryOptions.firstRetryIntervalInMilliseconds),
                    input: name,
                    instanceId: id,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    actions:
                    [
                        [
                            new CallSubOrchestratorWithRetryAction(
                                "SayHelloInline",
                                retryOptions,
                                name,
                                childId,
                            ),
                        ],
                    ],
                }),
            );
        });

        it("retries a failed suborchestrator function if < max attempts", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithSubOrchestratorRetry;
            const name = "World";
            const id = uuidv1();
            const childId = `${id}:0`;
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetSayHelloWithSubOrchestratorRetryFailOne(
                        moment.utc().toDate(),
                        childId,
                        name,
                    ),
                    input: name,
                    instanceId: id,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    actions:
                    [
                        [
                            new CallSubOrchestratorWithRetryAction(
                                "SayHelloInline",
                                new RetryOptions(10000, 2),
                                name,
                                childId,
                            ),
                        ],
                    ],
                }),
            );
        });

        it("reports a failed suborchestrator function if >= max attempts", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithSubOrchestratorRetry;
            const name = "World";
            const id = uuidv1();
            const childId = `${id}:0`;
            const retryOptions = new RetryOptions(10000, 2);
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetSayHelloWithSubOrchestratorRetryRetryTwo(
                        moment.utc().toDate(),
                        childId,
                        name,
                        retryOptions.firstRetryIntervalInMilliseconds),
                    input: name,
                    instanceId: id,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.an("object").that.deep.include({
                isDone: false,
                actions:
                [
                    [
                        new CallSubOrchestratorWithRetryAction(
                            "SayHelloInline",
                            new RetryOptions(10000, 2),
                            name,
                            childId,
                        ),
                    ],
                ],
            });
            expect(mockContext.doneValue.error).to
                .include("Sub orchestrator function 'SayHelloInline' failed: Result: Failure");
        });

        it("handles a completed suborchestrator function", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithSubOrchestratorRetry;
            const name = "World";
            const id = uuidv1();
            const childId = `${id}:0`;
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetSayHelloWithSubOrchestratorReplayOne(
                        moment.utc().toDate(),
                        "SayHelloWithSubOrchestratorRetry",
                        "SayHelloInline",
                        childId,
                        name),
                    input: name,
                    instanceId: id,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: true,
                    actions:
                    [
                        [
                            new CallSubOrchestratorWithRetryAction(
                                "SayHelloInline",
                                new RetryOptions(10000, 2),
                                name,
                                childId,
                            ),
                        ],
                    ],
                    output: `Hello, ${name}!`,
                }),
            );
        });
    });

    describe("continueAsNew()", () => {
        it("schedules a continueAsNew request", () => {
            const orchestrator = TestOrchestrations.ContinueAsNewCounter;
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetOrchestratorStart(
                        "ContinueAsNewCounter",
                        moment.utc().toDate(),
                    ),
                    input: { value: 5 },
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    actions:
                    [
                        [ new ContinueAsNewAction({ value: 6 }) ],
                    ],
                }),
            );
        });
    });

    describe("createTimer()", () => {
        it("schedules a timer", async () => {
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
                new OrchestratorState({
                    isDone: false,
                    actions:
                    [
                        [ new CreateTimerAction(fireAt) ],
                    ],
                }),
            );
        });

        it("proceeds after a timer fires", async () => {
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
                new OrchestratorState({
                    isDone: true,
                    actions:
                    [
                        [ new CreateTimerAction(fireAt) ],
                    ],
                    output: "Timer fired!",
                }),
            );
        });
    });

    describe("setCustomStatus()", () => {
        it("sets a custom status", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithCustomStatus;
            const name = "World!";
            const mockContext = new MockContext({
                context: {
                    history: TestHistories.GetSayHelloWithActivityReplayOne(
                        "SayHelloWithCustomStatus",
                        moment.utc().toDate(),
                        name,
                    ),
                    input: name,
                },
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.deep.eq(
                new OrchestratorState({
                    isDone: false,
                    actions:
                    [
                        [ new CallActivityAction("Hello", "Tokyo") ],
                        [ new CallActivityAction("Hello", "Seattle") ],
                    ],
                    customStatus: "Tokyo",
                }),
            );
        });
    });

    describe("waitForExternalEvent()", () => {
        it("waits for an external event", async () => {
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
                new OrchestratorState({
                    isDone: false,
                    actions:
                    [
                        [ new WaitForExternalEventAction("start") ],
                    ],
                }),
            );
        });

        it("proceeds when the correctly-named event is received", async () => {
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
                new OrchestratorState({
                    isDone: false,
                    actions:
                    [
                        [ new WaitForExternalEventAction("start") ],
                        [ new CallActivityAction("Hello", name) ],
                    ],
                }),
            );
        });

        it("does not proceed when an incorrectly-named event is received", async () => {
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
                new OrchestratorState({
                    isDone: false,
                    actions:
                    [
                        [ new WaitForExternalEventAction("start") ],
                    ],
                }),
            );
        });
    });

    describe("Task.all() and Task.any()", () => {
        it("schedules a parallel set of tasks", async () => {
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
                new OrchestratorState({
                    isDone: false,
                    actions:
                    [
                        [ new CallActivityAction("GetFileList", "C:\\Dev")],
                        filePaths.map((file) => new CallActivityAction("GetFileSize", file)),
                    ],
                }),
            );
        });

        it("Task.all does not proceed if some parallel tasks have completed", async () => {
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
                new OrchestratorState({
                    isDone: false,
                    actions:
                    [
                        [ new CallActivityAction("GetFileList", "C:\\Dev")],
                        filePaths.map((file) => new CallActivityAction("GetFileSize", file)),
                    ],
                }),
            );
        });

        it("Task.all proceeds if all parallel tasks have completed", async () => {
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
                new OrchestratorState({
                    isDone: true,
                    actions:
                    [
                        [ new CallActivityAction("GetFileList", "C:\\Dev")],
                        filePaths.map((file) => new CallActivityAction("GetFileSize", file)),
                    ],
                    output: 6,
                }),
            );
        });

        it("Task.any proceeds if a scheduled parallel task completes in order", async () => {
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
                new OrchestratorState({
                    isDone: true,
                    actions:
                    [
                        [ new CallActivityAction("TaskA", false), new CallActivityAction("TaskB", true) ],
                    ],
                    output: "A",
                }),
            );
        });

        it("Task.any proceeds if a scheduled parallel task completes out of order", async () => {
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
                new OrchestratorState({
                    isDone: true,
                    actions:
                    [
                        [ new CallActivityAction("TaskA", true), new CallActivityAction("TaskB", false) ],
                    ],
                    output: "B",
                }),
            );
        });
    });

    // rewind

    // extended sessions

    // ...
});

class MockContext {
    constructor(
        public bindings: IBindings,
        public df?: IDurableOrchestrationContext,
        public doneValue?: IOrchestratorState,
    ) { }

    public done(err?: string, result?: IOrchestratorState) {
        if (err) {
            throw new Error(err);
        } else {
            this.doneValue = result;
        }
    }
}

interface IBindings {
    [key: string]: unknown;
}
