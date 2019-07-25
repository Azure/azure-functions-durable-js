import { expect } from "chai";
import "mocha";
import * as moment from "moment";
import * as uuidv1 from "uuid/v1";
import {
    CallActivityAction, CallActivityWithRetryAction, CallSubOrchestratorAction,
    CallSubOrchestratorWithRetryAction, Constants, ContinueAsNewAction, CreateTimerAction,
    DurableOrchestrationBindingInfo, DurableOrchestrationContext, IOrchestratorState,
    OrchestratorState, RetryOptions, WaitForExternalEventAction,
} from "../../src/classes";
import { TestHistories } from "../testobjects/testhistories";
import { TestOrchestrations } from "../testobjects/TestOrchestrations";

describe("Orchestrator", () => {
    const falsyValues = [ false, 0, "", null, undefined, NaN ];

    it("handles a simple orchestration function (no activity functions)", async () => {
        const orchestrator = TestOrchestrations.SayHelloInline;
        const name = "World";
        const mockContext = new MockContext({
            context: new DurableOrchestrationBindingInfo(
                TestHistories.GetOrchestratorStart(
                    "SayHelloInline",
                    moment.utc().toDate(),
                    name),
                name,
            ),
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

    falsyValues.forEach((falsyValue) => {
        it(`handles an orchestration function that returns ${falsyValue === "" ? "empty string" : falsyValue}`, async () => {
            const orchestrator = TestOrchestrations.PassThrough;
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetOrchestratorStart(
                        "PassThrough",
                        moment.utc().toDate(),
                        falsyValue,
                    ),
                    falsyValue,
                ),
            });
            orchestrator(mockContext);

            expect(mockContext.doneValue).to.deep.equal(
                new OrchestratorState({
                    isDone: true,
                    actions: [],
                    output: falsyValue,
                }),
            );
            if (isNaN(falsyValue as number)) {
                expect(isNaN(mockContext.doneValue.output as number)).to.equal(true);
            } else {
                expect(mockContext.doneValue.output).to.equal(falsyValue);
            }
            expect(mockContext.err).to.equal(null);
        });
    });

    describe("Properties", () => {
        it("assigns instanceId", async () => {
            const orchestrator = TestOrchestrations.SayHelloInline;
            const name = "World";
            const id = uuidv1();
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetOrchestratorStart(
                        "SayHelloInline",
                        moment.utc().toDate(),
                        name),
                    name,
                    id,
                ),
            });
            orchestrator(mockContext);

            expect(mockContext.df.instanceId).to.be.equal(id);
        });

        it("assigns isReplaying", async () => {
            const orchestrator = TestOrchestrations.SayHelloSequence;
            const name = "World";
            const replaying = true;

            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetSayHelloWithActivityReplayOne(
                        "SayHelloWithActivity",
                        moment.utc().toDate(),
                        name),
                    name,
                    undefined,
                    replaying,
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.df.isReplaying).to.be.equal(replaying);
        });

        it("assigns parentInstanceId", async () => {
            const orchestrator = TestOrchestrations.SayHelloSequence;
            const name = "World";
            const id = uuidv1();

            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetSayHelloWithActivityReplayOne(
                        "SayHelloWithActivity",
                        moment.utc().toDate(),
                        name),
                    name,
                    undefined,
                    undefined,
                    id,
                ),
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
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetSayHelloWithActivityReplayOne(
                        "SayHelloWithActivity",
                        startTimestamp,
                        name),
                    name,
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.df.currentUtcDateTime).to.be.deep.equal(nextTimestamp);
        });
    });

    describe("Error Handling", () => {
        it("reports an unhandled exception from orchestrator", async () => {
            const orchestrator = TestOrchestrations.ThrowsExceptionInline;
            const mockContext =  new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetOrchestratorStart(
                        "ThrowsExceptionInline",
                        moment.utc().toDate(),
                    ),
                ),
            });
            const expectedErr = "Exception from Orchestrator";

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.an("object").that.deep.include({
                isDone: false,
                actions: [],
            });
            expect(mockContext.doneValue.error).to.include(expectedErr);

            expect(mockContext.err.toString()).to.include(expectedErr);
        });

        it("reports an unhandled exception from activity passed through orchestrator", async () => {
            const orchestrator = TestOrchestrations.ThrowsExceptionFromActivity;
            const mockContext =  new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetThrowsExceptionFromActivityReplayOne(
                        moment.utc().toDate(),
                    ),
                ),
            });
            const expectedErr = "Activity function 'ThrowsErrorActivity' failed.";

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.an("object").that.deep.include({
                isDone: false,
                actions:
                [
                    [ new CallActivityAction("ThrowsErrorActivity") ],
                ],
            });
            expect(mockContext.doneValue.error).to.include(expectedErr);

            expect(mockContext.err.toString()).to.include(expectedErr);
        });

        it("schedules an activity function after orchestrator catches an exception", async () => {
            const orchestrator = TestOrchestrations.ThrowsExceptionFromActivityWithCatch;
            const name = "World";
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetThrowsExceptionFromActivityReplayOne(
                        moment.utc().toDate(),
                    ),
                    name,
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
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
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetOrchestratorStart(
                        "SayHelloWithActivity",
                        moment.utc().toDate(),
                        name),
                    name,
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
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
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetOrchestratorStart(
                        "CallActivityNoInput",
                        moment.utc().toDate()),
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
                    actions:
                    [
                        [ new CallActivityAction("ReturnsFour") ],
                    ],
                }),
            );
        });

        describe("Falsy Input", () => {
            falsyValues.forEach((falsyValue) => {
                it(`schedules an activity function with input ${falsyValue}`, async () => {
                    const orchestrator = TestOrchestrations.SayHelloWithActivity;
                    const mockContext = new MockContext({
                        context: new DurableOrchestrationBindingInfo(
                            TestHistories.GetOrchestratorStart(
                                "SayHelloWithActivity",
                                moment.utc().toDate(),
                                falsyValue),
                            falsyValue,
                        ),
                    });

                    orchestrator(mockContext);

                    expect(mockContext.doneValue).to.be.deep.equal(
                        new OrchestratorState({
                            isDone: false,
                            output: undefined,
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
                        context: new DurableOrchestrationBindingInfo(
                            TestHistories.GetSayHelloWithActivityReplayOne(
                                "SayHelloWithActivity",
                                moment.utc().toDate(),
                                falsyValue),
                            falsyValue,
                        ),
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
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetSayHelloWithActivityReplayOne(
                        "SayHelloWithActivity",
                        moment.utc().toDate(),
                        name),
                    name,
                ),
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
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetHelloSequenceReplayFinal(
                        "SayHelloSequence",
                        moment.utc().toDate(),
                    ),
                ),
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
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetOrchestratorStart(
                        "SayHelloWithActivityRetryOptionsUndefined",
                        moment.utc().toDate()),
                ),
            });
            const expectedErr = "retryOptions: Expected object of type RetryOptions but got undefined; are you missing properties?";

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.an("object").that.deep.include(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
                    actions: [],
                }),
            );
            expect(mockContext.doneValue.error).to
                .include(expectedErr);

            expect(mockContext.err.toString()).to.include(expectedErr);
        });

        it("schedules an activity function", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithActivityRetry;
            const name = "World";
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetOrchestratorStart(
                        "SayHelloWithActivityRetry",
                        moment.utc().toDate(),
                        name),
                    name,
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
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
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetSayHelloWithActivityRetryRetryOne(
                        moment.utc().toDate(),
                        name,
                        retryOptions.firstRetryIntervalInMilliseconds),
                    name,
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
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
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetSayHelloWithActivityRetryFailOne(
                        moment.utc().toDate(),
                        name),
                    name,
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
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
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetSayHelloWithActivityRetryRetryTwo(
                        moment.utc().toDate(),
                        name,
                        retryOptions.firstRetryIntervalInMilliseconds),
                    name,
                ),
            });
            const expectedErr = "Activity function 'Hello' failed: Result: Failure";

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
                .include(expectedErr);

            expect(mockContext.err.toString()).to.include(expectedErr);
        });

        it("handles a completed activity function", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithActivityRetry;
            const name = "World";
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetSayHelloWithActivityReplayOne(
                        "SayHelloWithActivityRetry",
                        moment.utc().toDate(),
                        name),
                    name,
                ),
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
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetOrchestratorStart(
                        "SayHelloWithSubOrchestrator",
                        moment.utc().toDate(),
                    ),
                    name,
                    id,
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
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
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetOrchestratorStart(
                        "SayHelloWithSubOrchestrator",
                        moment.utc().toDate(),
                    ),
                    name,
                    id,
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
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
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetSayHelloWithSubOrchestratorReplayOne(
                        moment.utc().toDate(),
                        "SayHelloWithSubOrchestrator",
                        "SayHelloWithActivity",
                        childId,
                        name,
                    ),
                    name,
                    id,
                ),
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
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetSayHelloWithSubOrchestratorFail(
                        moment.utc().toDate(),
                        "SayHelloWithSubOrchestrator",
                        "SayHelloWithActivity",
                        childId,
                        name,
                    ),
                    name,
                    id,
                ),
            });
            const expectedErr = "Sub orchestrator function 'SayHelloInline' failed: Result: Failure";

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.an("object").that.deep.include({
                isDone: false,
                actions:
                [
                    [ new CallSubOrchestratorAction("SayHelloWithActivity", childId, name) ],
                ],
            });
            expect(mockContext.doneValue.error).to
                .include(expectedErr);

            expect(mockContext.err.toString()).to.include(expectedErr);
        });
    });

    describe("callSubOrchestratorWithRetry()", () => {
        it("reports an error when retryOptions is undefined", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithSubOrchestratorRetryNoOptions;
            const id = uuidv1();
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetOrchestratorStart(
                        "SayHelloWithSubOrchestratorRetryNoOptions",
                        moment.utc().toDate()),
                    undefined,
                    id,
                ),
            });
            const expectedErr = "retryOptions: Expected object of type RetryOptions but got undefined; are you missing properties?";

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.an("object").that.deep.include({
                isDone: false,
                actions: [],
            });
            expect(mockContext.doneValue.error).to
                .include(expectedErr);

            expect(mockContext.err.toString()).to.include(expectedErr);
        });

        it("schedules a suborchestrator function", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithSubOrchestratorRetry;
            const name = "World";
            const id = uuidv1();
            const childId = `${id}:0`;
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetOrchestratorStart(
                        "SayHelloWithSubOrchestratorRetry",
                        moment.utc().toDate(),
                        name),
                    name,
                    id,
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
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
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetSayHelloWithSubOrchestratorRetryRetryOne(
                        moment.utc().toDate(),
                        childId,
                        name,
                        retryOptions.firstRetryIntervalInMilliseconds),
                    name,
                    id,
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
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
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetSayHelloWithSubOrchestratorRetryFailOne(
                        moment.utc().toDate(),
                        childId,
                        name,
                    ),
                    name,
                    id,
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
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
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetSayHelloWithSubOrchestratorRetryRetryTwo(
                        moment.utc().toDate(),
                        childId,
                        name,
                        retryOptions.firstRetryIntervalInMilliseconds),
                    name,
                    id,
                ),
            });
            const expectedErr = "Sub orchestrator function 'SayHelloInline' failed: Result: Failure";

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
                .include(expectedErr);

            expect(mockContext.err.toString()).to.include(expectedErr);
        });

        it("handles a completed suborchestrator function", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithSubOrchestratorRetry;
            const name = "World";
            const id = uuidv1();
            const childId = `${id}:0`;
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetSayHelloWithSubOrchestratorReplayOne(
                        moment.utc().toDate(),
                        "SayHelloWithSubOrchestratorRetry",
                        "SayHelloInline",
                        childId,
                        name),
                    name,
                    id,
                ),
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
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetOrchestratorStart(
                        "ContinueAsNewCounter",
                        moment.utc().toDate(),
                    ),
                    { value: 5 },
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
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
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetOrchestratorStart(
                        "WaitOnTimer",
                        startMoment.toDate(),
                    ),
                    fireAt,
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
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
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetWaitOnTimerFired(
                        startTimestamp,
                        fireAt,
                    ),
                    fireAt,
                ),
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

    describe("newGuid()", () => {
        it("generates consistent GUIDs", () => {
            const orchestrator = TestOrchestrations.GuidGenerator;
            const currentUtcDateTime = moment.utc().toDate();
            const instanceId = uuidv1();

            const mockContext1 = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetOrchestratorStart(
                        "GuidGenerator",
                        currentUtcDateTime,
                    ),
                    undefined,
                    instanceId,
                ),
            });
            const mockContext2 = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetOrchestratorStart(
                        "GuidGenerator",
                        currentUtcDateTime,
                    ),
                    undefined,
                    instanceId,
                ),
            });

            orchestrator(mockContext1);
            orchestrator(mockContext2);

            expect(mockContext1.doneValue.isDone).to.equal(true);
            expect(mockContext1.doneValue).to.deep.equal(mockContext2.doneValue);
        });
    });

    describe("setCustomStatus()", () => {
        it("sets a custom status", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithCustomStatus;
            const name = "World!";
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetSayHelloWithActivityReplayOne(
                        "SayHelloWithCustomStatus",
                        moment.utc().toDate(),
                        name,
                    ),
                    name,
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.deep.eq(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
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
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetOrchestratorStart(
                        "WaitForExternalEvent,",
                        moment.utc().toDate(),
                    ),
                    undefined,
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
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
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetWaitForExternalEventEventReceived(
                        moment.utc().toDate(),
                        "start",
                        name,
                    ),
                    undefined,
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
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
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetWaitForExternalEventEventReceived(
                        moment.utc().toDate(),
                        "wrongEvent",
                        name,
                    ),
                    undefined,
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
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
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetFanOutFanInDiskUsageReplayOne(
                        moment.utc().toDate(),
                        filePaths,
                    ),
                    "C:\\Dev",
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
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
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetFanOutFanInDiskUsagePartComplete(
                        moment.utc().toDate(),
                        filePaths,
                    ),
                    "C:\\Dev",
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
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
                context: new DurableOrchestrationBindingInfo (
                    TestHistories.GetFanOutFanInDiskUsageComplete(
                        moment.utc().toDate(),
                        filePaths,
                    ),
                    "C:\\Dev",
                ),
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

        it("Task.all throws if a parallel task has faulted", async () => {
            const orchestrator = TestOrchestrations.FanOutFanInDiskUsage;
            const filePaths = ["file1.txt", "file2.png", "file3.csx"];
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo (
                    TestHistories.GetFanOutFanInDiskUsageFaulted(
                        moment.utc().toDate(),
                        filePaths,
                    ),
                    "C:\\Dev",
                ),
            });

            const expectedErr = "Activity function 'GetFileSize' failed: Could not find file.";

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.include(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
                    actions:
                    [
                        [ new CallActivityAction("GetFileList", "C:\\Dev")],
                        filePaths.map((file) => new CallActivityAction("GetFileSize", file)),
                    ],
                }),
            );
            expect(mockContext.doneValue.error).to.include(expectedErr);
            expect(mockContext.err.toString()).to.include(expectedErr);
        });

        it("Task.any proceeds if a scheduled parallel task completes in order", async () => {
            const orchestrator = TestOrchestrations.AnyAOrB;
            const completeInOrder = true;
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetAnyAOrB(
                        moment.utc().toDate(),
                        completeInOrder,
                    ),
                    completeInOrder,
                ),
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
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetAnyAOrB(
                        moment.utc().toDate(),
                        completeInOrder,
                    ),
                    completeInOrder,
                ),
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
        public df?: DurableOrchestrationContext,
        public doneValue?: IOrchestratorState,
        public err?: Error | string | null,
    ) { }

    public done(err?: Error | string | null, result?: IOrchestratorState) {
        this.doneValue = result;
        this.err = err;
    }
}

interface IBindings {
    [key: string]: unknown;
}
