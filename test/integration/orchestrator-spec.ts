/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { expect } from "chai";
import "mocha";
import * as moment from "moment";
import * as uuidv1 from "uuid/v1";
import { DummyOrchestrationContext, ManagedIdentityTokenSource } from "../../src";
import { SignalEntityAction } from "../../src/actions/signalentityaction";
import {
    ActionType,
    CallActivityAction,
    CallActivityWithRetryAction,
    CallEntityAction,
    CallHttpAction,
    CallSubOrchestratorAction,
    CallSubOrchestratorWithRetryAction,
    ContinueAsNewAction,
    CreateTimerAction,
    DurableHttpRequest,
    DurableHttpResponse,
    EntityId,
    ExternalEventType,
    HistoryEvent,
    LockState,
    OrchestratorState,
    RetryOptions,
    WaitForExternalEventAction,
} from "../../src/classes";
import { OrchestrationFailureError } from "../../src/orchestrationfailureerror";
import { ReplaySchema } from "../../src/replaySchema";
import { DurableOrchestrationInput } from "../../src/testingUtils";
import { TestHistories } from "../testobjects/testhistories";
import { TestOrchestrations } from "../testobjects/TestOrchestrations";
import { TestUtils } from "../testobjects/testutils";

describe("Orchestrator", () => {
    const falsyValues = [false, 0, "", null, undefined, NaN];

    it("allows orchestrations with no yield-statements", async () => {
        const orchestrator = TestOrchestrations.NotGenerator;
        const mockContext = new DummyOrchestrationContext();
        const orchestrationInput = new DurableOrchestrationInput(
            "",
            TestHistories.StarterHistory(moment.utc().toDate())
        );
        const result = await orchestrator(orchestrationInput, mockContext);

        expect(result).to.be.deep.equal(
            new OrchestratorState(
                {
                    isDone: true,
                    actions: [],
                    output: `Hello`,
                    schemaVersion: ReplaySchema.V1,
                },
                true
            )
        );
    });

    it("doesn't allow yielding non-Task types", async () => {
        const orchestrator = TestOrchestrations.YieldInteger;
        const mockContext = new DummyOrchestrationContext();
        const orchestrationInput = new DurableOrchestrationInput(
            "",
            TestHistories.StarterHistory(moment.utc().toDate())
        );

        const errorMsg =
            `Durable Functions programming constraint violation: Orchestration yielded data of type number.` +
            " Only Task types can be yielded. Please check your yield statements to make sure you only yield Task types resulting from calling Durable Functions APIs.";

        let errored = false;
        try {
            await orchestrator(orchestrationInput, mockContext);
        } catch (err) {
            errored = true;
            expect(err).to.be.an.instanceOf(OrchestrationFailureError);
            const orchestrationState = TestUtils.extractStateFromError(
                err as OrchestrationFailureError
            );
            expect(orchestrationState).to.be.an("object").that.deep.include({
                isDone: false,
                actions: [],
            });
            expect(orchestrationState.error).to.include(errorMsg);
        }
        expect(errored).to.be.true;
    });

    it("handles a simple orchestration function (no activity functions)", async () => {
        const orchestrator = TestOrchestrations.SayHelloInline;
        const name = "World";
        const mockContext = new DummyOrchestrationContext();
        const orchestrationInput = new DurableOrchestrationInput(
            "",
            TestHistories.GetOrchestratorStart("SayHelloInline", moment.utc().toDate(), name),
            name
        );
        const result = await orchestrator(orchestrationInput, mockContext);

        expect(result).to.be.deep.equal(
            new OrchestratorState(
                {
                    isDone: true,
                    actions: [],
                    output: `Hello, ${name}!`,
                    schemaVersion: ReplaySchema.V1,
                },
                true
            )
        );
    });

    describe("handle falsy values", () => {
        for (const falsyValue of falsyValues) {
            it(`handles an orchestration function that returns ${
                falsyValue === "" ? "empty string" : falsyValue
            }`, async () => {
                const orchestrator = TestOrchestrations.PassThrough;
                const mockContext = new DummyOrchestrationContext();
                const orchestrationInput = new DurableOrchestrationInput(
                    "",
                    TestHistories.GetOrchestratorStart(
                        "PassThrough",
                        moment.utc().toDate(),
                        falsyValue
                    ),
                    falsyValue
                );
                const result = await orchestrator(orchestrationInput, mockContext);
                expect(result).to.deep.equal(
                    new OrchestratorState(
                        {
                            isDone: true,
                            actions: [],
                            output: falsyValue,
                            schemaVersion: ReplaySchema.V1,
                        },
                        true
                    )
                );
                if (isNaN(falsyValue as number)) {
                    expect(isNaN(result!.output as number)).to.equal(true);
                } else {
                    expect(result!.output).to.equal(falsyValue);
                }
            });
        }
    });

    describe("Properties", () => {
        it("assigns instanceId", async () => {
            const orchestrator = TestOrchestrations.SayHelloInline;
            const name = "World";
            const id = uuidv1();
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                id,
                TestHistories.GetOrchestratorStart("SayHelloInline", moment.utc().toDate(), name),
                name
            );
            await orchestrator(orchestrationInput, mockContext);

            expect(mockContext.df!.instanceId).to.be.equal(id);
        });

        it("assigns isReplaying", async () => {
            const orchestrator = TestOrchestrations.SayHelloSequence;
            const name = "World";

            const mockHistory = TestHistories.GetSayHelloWithActivityReplayOne(
                "SayHelloWithActivity",
                moment.utc().toDate(),
                name
            );

            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput("", mockHistory, name);

            await orchestrator(orchestrationInput, mockContext);

            const lastEvent = mockHistory.pop() as HistoryEvent;

            expect(mockContext.df!.isReplaying).to.be.equal(lastEvent.IsPlayed);
        });

        it("assigns parentInstanceId", async () => {
            const orchestrator = TestOrchestrations.SayHelloSequence;
            const name = "World";
            const id = uuidv1();

            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetSayHelloWithActivityReplayOne(
                    "SayHelloWithActivity",
                    moment.utc().toDate(),
                    name
                ),
                name,
                undefined,
                undefined,
                undefined,
                ReplaySchema.V1,
                undefined,
                id
            );

            await orchestrator(orchestrationInput, mockContext);

            expect(mockContext.df!.parentInstanceId).to.be.equal(id);
        });

        it("updates currentUtcDateTime to the most recent OrchestratorStarted timestamp", async () => {
            const orchestrator = TestOrchestrations.SayHelloSequence;
            const name = "World";
            const startTimestamp = moment.utc().toDate();
            const nextTimestamp = moment(startTimestamp).add(1, "s").toDate();

            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetSayHelloWithActivityReplayOne(
                    "SayHelloWithActivity",
                    startTimestamp,
                    name
                ),
                name
            );

            await orchestrator(orchestrationInput, mockContext);

            expect(mockContext.df!.currentUtcDateTime).to.be.deep.equal(nextTimestamp);
        });

        it("uses existing currentUtcDateTime if OrchestratorStarted events are exhausted", async () => {
            const orchestrator = TestOrchestrations.TimestampExhaustion;
            const startTimestamp = moment.utc().toDate();

            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetTimestampExhaustion(startTimestamp),
                {
                    delayMergeUntilSecs: 1,
                }
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result!.error).to.equal(undefined);
        });
    });

    describe("Error Handling", () => {
        it("reports an unhandled exception from orchestrator", async () => {
            const orchestrator = TestOrchestrations.ThrowsExceptionInline;
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetOrchestratorStart("ThrowsExceptionInline", moment.utc().toDate())
            );
            const expectedErr = "Exception from Orchestrator";
            let errored = false;
            try {
                await orchestrator(orchestrationInput, mockContext);
            } catch (err) {
                errored = true;
                expect(err).to.be.an.instanceOf(OrchestrationFailureError);
                const orchestrationState = TestUtils.extractStateFromError(
                    err as OrchestrationFailureError
                );
                expect(orchestrationState).to.be.an("object").that.deep.include({
                    isDone: false,
                    actions: [],
                });
                expect(orchestrationState.error).to.include(expectedErr);
            }
            expect(errored).to.be.true;
        });
        it("reports an unhandled exception from activity passed through orchestrator", async () => {
            const orchestrator = TestOrchestrations.ThrowsExceptionFromActivity;
            const mockContext = new DummyOrchestrationContext();
            const orchestrationTrigger = new DurableOrchestrationInput(
                "",
                TestHistories.GetThrowsExceptionFromActivityReplayOne(moment.utc().toDate())
            );
            const expectedErr = "Activity function 'ThrowsErrorActivity' failed.";
            let errored = false;
            try {
                await orchestrator(orchestrationTrigger, mockContext);
            } catch (err) {
                errored = true;
                expect(err).to.be.an.instanceOf(OrchestrationFailureError);
                const orchestrationState = TestUtils.extractStateFromError(
                    err as OrchestrationFailureError
                );
                expect(orchestrationState)
                    .to.be.an("object")
                    .that.deep.include({
                        isDone: false,
                        actions: [
                            [
                                {
                                    actionType: ActionType.CallActivity,
                                    functionName: "ThrowsErrorActivity",
                                },
                            ],
                        ],
                    });
                expect(orchestrationState.error).to.include(expectedErr);
            }
            expect(errored).to.be.true;
        });
        it("schedules an activity function after orchestrator catches an exception", async () => {
            const orchestrator = TestOrchestrations.ThrowsExceptionFromActivityWithCatch;
            const name = "World";
            const mockContext = new DummyOrchestrationContext();
            const orchestrationTrigger = new DurableOrchestrationInput(
                "",
                TestHistories.GetThrowsExceptionFromActivityReplayOne(moment.utc().toDate()),
                name
            );
            const result = await orchestrator(orchestrationTrigger, mockContext);
            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: false,
                        output: undefined,
                        actions: [
                            [new CallActivityAction("ThrowsErrorActivity")],
                            [new CallActivityAction("Hello", name)],
                        ],
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });
    });

    describe("callActivity()", () => {
        it("schedules an activity function", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithActivity;
            const name = "World";
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetOrchestratorStart(
                    "SayHelloWithActivity",
                    moment.utc().toDate(),
                    name
                ),
                name
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: false,
                        output: undefined,
                        actions: [[new CallActivityAction("Hello", name)]],
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("schedules an activity function with no input", async () => {
            const orchestrator = TestOrchestrations.CallActivityNoInput;
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetOrchestratorStart("CallActivityNoInput", moment.utc().toDate())
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: false,
                        output: undefined,
                        actions: [[new CallActivityAction("ReturnsFour")]],
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        describe("Falsy Input", () => {
            falsyValues.forEach((falsyValue) => {
                it(`schedules an activity function with input ${falsyValue}`, async () => {
                    const orchestrator = TestOrchestrations.SayHelloWithActivity;
                    const mockContext = new DummyOrchestrationContext();
                    const orchestrationInput = new DurableOrchestrationInput(
                        "",
                        TestHistories.GetOrchestratorStart(
                            "SayHelloWithActivity",
                            moment.utc().toDate(),
                            falsyValue
                        ),
                        falsyValue
                    );

                    const result = await orchestrator(orchestrationInput, mockContext);

                    expect(result).to.be.deep.equal(
                        new OrchestratorState(
                            {
                                isDone: false,
                                output: undefined,
                                actions: [[new CallActivityAction("Hello", falsyValue)]],
                                schemaVersion: ReplaySchema.V1,
                            },
                            true
                        )
                    );
                });

                it(`handles a completed activity function with falsy input ${falsyValue}`, async () => {
                    const orchestrator = TestOrchestrations.SayHelloWithActivity;
                    const mockContext = new DummyOrchestrationContext();
                    const orchestrationInput = new DurableOrchestrationInput(
                        "",
                        TestHistories.GetSayHelloWithActivityReplayOne(
                            "SayHelloWithActivity",
                            moment.utc().toDate(),
                            falsyValue
                        ),
                        falsyValue
                    );

                    const result = await orchestrator(orchestrationInput, mockContext);

                    expect(result).to.be.deep.equal(
                        new OrchestratorState(
                            {
                                isDone: true,
                                actions: [[new CallActivityAction("Hello", falsyValue)]],
                                output: `Hello, ${falsyValue}!`,
                                schemaVersion: ReplaySchema.V1,
                            },
                            true
                        )
                    );
                });
            });
        });

        it("handles a completed activity function", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithActivity;
            const name = "World";
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetSayHelloWithActivityReplayOne(
                    "SayHelloWithActivity",
                    moment.utc().toDate(),
                    name
                ),
                name
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: true,
                        actions: [[new CallActivityAction("Hello", name)]],
                        output: `Hello, ${name}!`,
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("is yielded twice, only scheduled once", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithActivityYieldTwice;
            const name = "World";
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetSayHelloWithActivityReplayOne(
                    "CallActivityYieldTwice",
                    moment.utc().toDate(),
                    name
                ),
                name
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: true,
                        output: `Hello, ${name}!`,
                        actions: [[new CallActivityAction("Hello", name)]],
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("handles a completed series of activity functions", async () => {
            const orchestrator = TestOrchestrations.SayHelloSequence;
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetHelloSequenceReplayFinal("SayHelloSequence", moment.utc().toDate())
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: true,
                        actions: [
                            [new CallActivityAction("Hello", "Tokyo")],
                            [new CallActivityAction("Hello", "Seattle")],
                            [new CallActivityAction("Hello", "London")],
                        ],
                        output: ["Hello, Tokyo!", "Hello, Seattle!", "Hello, London!"],
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });
    });

    describe("callActivityWithRetry()", () => {
        it("reports an error when retryOptions is undefined", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithActivityRetryNoOptions;
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetOrchestratorStart(
                    "SayHelloWithActivityRetryOptionsUndefined",
                    moment.utc().toDate()
                )
            );
            const expectedErr =
                "retryOptions: Expected object of type RetryOptions but got undefined; are you missing properties?";

            let errored = false;
            try {
                await orchestrator(orchestrationInput, mockContext);
            } catch (err) {
                errored = true;
                expect(err).to.be.an.instanceOf(OrchestrationFailureError);

                const orchestrationState = TestUtils.extractStateFromError(
                    err as OrchestrationFailureError
                );

                expect(orchestrationState).to.be.an("object").that.deep.include({
                    isDone: false,
                    actions: [],
                });
                expect(orchestrationState.error).to.include(expectedErr);
            }
            expect(errored).to.be.true;
        });

        it("schedules an activity function", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithActivityRetry;
            const name = "World";
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetOrchestratorStart(
                    "SayHelloWithActivityRetry",
                    moment.utc().toDate(),
                    name
                ),
                name
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: false,
                        output: undefined,
                        actions: [
                            [
                                new CallActivityWithRetryAction(
                                    "Hello",
                                    new RetryOptions(10000, 2),
                                    name
                                ),
                            ],
                        ],
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("schedules an activity function if < max attempts", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithActivityRetry;
            const name = "World";
            const retryOptions = new RetryOptions(10000, 2);
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetSayHelloWithActivityRetryRetryOne(
                    moment.utc().toDate(),
                    name,
                    retryOptions.firstRetryIntervalInMilliseconds
                ),
                name
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: false,
                        output: undefined,
                        actions: [[new CallActivityWithRetryAction("Hello", retryOptions, name)]],
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("retries a failed activity function if < max attempts", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithActivityRetry;
            const name = "World";
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetSayHelloWithActivityRetryFailOne(moment.utc().toDate(), name),
                name
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: false,
                        output: undefined,
                        actions: [
                            [
                                new CallActivityWithRetryAction(
                                    "Hello",
                                    new RetryOptions(10000, 2),
                                    name
                                ),
                            ],
                        ],
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("reports a failed activity function if >= max attempts", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithActivityRetry;
            const name = "World";
            const retryOptions = new RetryOptions(10000, 2);
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetSayHelloWithActivityRetryRetryTwo(
                    moment.utc().toDate(),
                    name,
                    retryOptions.firstRetryIntervalInMilliseconds
                ),
                name
            );
            const expectedErr = "Activity function 'Hello' failed: Result: Failure";

            let errored = false;
            try {
                await orchestrator(orchestrationInput, mockContext);
            } catch (err) {
                errored = true;
                expect(err).to.be.an.instanceOf(OrchestrationFailureError);

                const orchestrationState = TestUtils.extractStateFromError(
                    err as OrchestrationFailureError
                );

                expect(orchestrationState)
                    .to.be.an("object")
                    .that.deep.include({
                        isDone: false,
                        actions: [[new CallActivityWithRetryAction("Hello", retryOptions, name)]],
                    });
                expect(orchestrationState.error).to.include(expectedErr);
            }
            expect(errored).to.be.true;
        });

        it("handles a completed activity function", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithActivityRetry;
            const name = "World";
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetSayHelloWithActivityReplayOne(
                    "SayHelloWithActivityRetry",
                    moment.utc().toDate(),
                    name
                ),
                name
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: true,
                        actions: [
                            [
                                new CallActivityWithRetryAction(
                                    "Hello",
                                    new RetryOptions(10000, 2),
                                    name
                                ),
                            ],
                        ],
                        output: `Hello, ${name}!`,
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("works with fan-out/fan-in", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithActivityRetryFanout;
            const retryOptions = new RetryOptions(100, 5);
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetSayHelloWithActivityRetryFanout(
                    moment.utc().toDate(),
                    retryOptions.firstRetryIntervalInMilliseconds,
                    4
                ),
                undefined
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: true,
                        actions: [
                            [
                                new CallActivityWithRetryAction(
                                    "Hello",
                                    new RetryOptions(100, 5),
                                    "Tokyo"
                                ),
                                new CallActivityWithRetryAction(
                                    "Hello",
                                    new RetryOptions(100, 5),
                                    "Seattle"
                                ),
                            ],
                        ],
                        output: ["Hello, Tokyo!", "Hello, Seattle!"],
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("updates currentUtcDatetime after all retries fail", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithActivityRetryAndReturnTimestamps;
            const name = "World";
            const retryInterval = 10000;
            const retryOptions = new RetryOptions(retryInterval, 2);
            const startingTime = moment.utc().toDate();
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetSayHelloWithActivityRetryRetryTwo(
                    startingTime,
                    name,
                    retryOptions.firstRetryIntervalInMilliseconds
                ),
                name
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: true,
                        actions: [
                            [new CallActivityWithRetryAction("Hello", retryOptions, "World")],
                        ],
                        output: [
                            startingTime,
                            moment(startingTime).add(1, "m").add(30, "s").toDate(),
                        ],
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });
    });

    describe("callHttp()", () => {
        it("schedules simple HTTP GET calls", async () => {
            const orchestrator = TestOrchestrations.SendHttpRequest;
            const req = new DurableHttpRequest("GET", "https://bing.com");
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetOrchestratorStart("SendHttpRequest", moment.utc().toDate(), req),
                req
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: false,
                        output: undefined,
                        actions: [[new CallHttpAction(req)]],
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("schedules authenticated HTTP POST calls with headers", async () => {
            const orchestrator = TestOrchestrations.SendHttpRequest;
            const req = new DurableHttpRequest(
                "POST",
                "https://example.com/api",
                JSON.stringify({ foo: "bar" }),
                { "Content-Type": "application/json", Accept: "application/json" },
                new ManagedIdentityTokenSource("https://management.core.windows.net")
            );
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetOrchestratorStart("SendHttpRequest", moment.utc().toDate(), req),
                req
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            // This is the exact protocol expected by the durable extension
            expect(result).to.be.deep.equal({
                isDone: false,
                output: undefined,
                schemaVersion: 0,
                actions: [
                    [
                        {
                            actionType: 8,
                            httpRequest: {
                                method: req.method,
                                uri: req.uri,
                                content: req.c,
                                headers: req.headers,
                                asynchronousPatternEnabled: req.asynchronousPatternEnabled,
                                tokenSource: {
                                    resource: "https://management.core.windows.net",
                                    kind: "AzureManagedIdentity",
                                },
                            },
                        },
                    ],
                ],
            });
        });

        it("handles a completed HTTP request", async () => {
            const orchestrator = TestOrchestrations.SendHttpRequest;
            const req = new DurableHttpRequest("GET", "https://bing.com");
            const res = new DurableHttpResponse(200, '<!DOCTYPE html><html lang="en">...</html>', {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-control": "private, max-age=8",
            });
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetSendHttpRequestReplayOne(
                    "SendHttpRequest",
                    moment.utc().toDate(),
                    req,
                    res
                ),
                req
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: true,
                        actions: [[new CallHttpAction(req)]],
                        output: res,
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        describe("callHttp with polling", () => {
            it("returns the result of the first success non-redirect response", async () => {
                const orchestrator = TestOrchestrations.SendHttpRequest;
                const req = new DurableHttpRequest(
                    "GET",
                    "https://bing.com",
                    undefined,
                    undefined,
                    undefined,
                    true
                );
                const res = new DurableHttpResponse(
                    200,
                    '<!DOCTYPE html><html lang="en">...</html>',
                    {
                        "Content-Type": "text/html; charset=utf-8",
                        "Cache-control": "private, max-age=8",
                    }
                );

                const mockContext = new DummyOrchestrationContext();
                const orchestrationInput = new DurableOrchestrationInput(
                    "",
                    TestHistories.GetCompletedHttpRequestWithPolling(
                        moment.utc().toDate(),
                        req,
                        res,
                        30000
                    ),
                    req,
                    undefined,
                    undefined,
                    30000,
                    ReplaySchema.V3
                );

                const result = await orchestrator(orchestrationInput, mockContext);

                expect(result).to.be.deep.equal(
                    new OrchestratorState({
                        isDone: true,
                        actions: [[new CallHttpAction(req)]],
                        output: res,
                        schemaVersion: ReplaySchema.V3,
                    })
                );
            });
            it("returns the result of the first failure non-redirect response", async () => {
                const orchestrator = TestOrchestrations.SendHttpRequest;
                const req = new DurableHttpRequest(
                    "GET",
                    "https://bing.com",
                    undefined,
                    undefined,
                    undefined,
                    true
                );
                const res = new DurableHttpResponse(404, "Not found!", {});

                const mockContext = new DummyOrchestrationContext();
                const orchestrationInput = new DurableOrchestrationInput(
                    "",
                    TestHistories.GetCompletedHttpRequestWithPolling(
                        moment.utc().toDate(),
                        req,
                        res,
                        30000
                    ),
                    req,
                    undefined,
                    undefined,
                    30000,
                    ReplaySchema.V3
                );

                const result = await orchestrator(orchestrationInput, mockContext);

                expect(result).to.be.deep.equal(
                    new OrchestratorState({
                        isDone: true,
                        actions: [[new CallHttpAction(req)]],
                        output: res,
                        schemaVersion: ReplaySchema.V3,
                    })
                );
            });
            it("does no polling if location header is not set", async () => {
                const orchestrator = TestOrchestrations.SendHttpRequest;
                const req = new DurableHttpRequest("GET", "https://bing.com");

                const fakeRedirectResponse = new DurableHttpResponse(
                    202,
                    "redirect without header",
                    {}
                );

                const mockContext = new DummyOrchestrationContext();
                const orchestrationInput = new DurableOrchestrationInput(
                    "",
                    TestHistories.GetSendHttpRequestReplayOne(
                        "SendHttpRequest",
                        moment.utc().toDate(),
                        req,
                        fakeRedirectResponse
                    ),
                    req,
                    undefined,
                    undefined,
                    30000,
                    ReplaySchema.V3
                );

                const result = await orchestrator(orchestrationInput, mockContext);

                expect(result).to.be.deep.equal(
                    new OrchestratorState({
                        isDone: true,
                        output: fakeRedirectResponse,
                        actions: [[new CallHttpAction(req)]],
                        schemaVersion: ReplaySchema.V3,
                    })
                );
            });
            it("treats headers case-insensitively", async () => {
                const orchestrator = TestOrchestrations.SendHttpRequest;
                const req = new DurableHttpRequest("GET", "https://bing.com");

                const fakeRedirectResponse = new DurableHttpResponse(202, "redirect", {
                    LoCaTiOn: "https://bing.com",
                });

                const mockContext = new DummyOrchestrationContext();
                const orchestrationInput = new DurableOrchestrationInput(
                    "",
                    TestHistories.GetSendHttpRequestReplayOne(
                        "SendHttpRequest",
                        moment.utc().toDate(),
                        req,
                        fakeRedirectResponse
                    ),
                    req,
                    undefined,
                    undefined,
                    30000,
                    ReplaySchema.V3
                );

                const result = await orchestrator(orchestrationInput, mockContext);

                expect(result).to.be.deep.equal(
                    new OrchestratorState({
                        isDone: false,
                        output: undefined,
                        actions: [[new CallHttpAction(req)]],
                        schemaVersion: ReplaySchema.V3,
                    })
                );
            });
            it("does not complete if redirect response is received", async () => {
                const orchestrator = TestOrchestrations.SendHttpRequest;
                const req = new DurableHttpRequest(
                    "GET",
                    "https://bing.com",
                    undefined,
                    undefined,
                    undefined,
                    true
                );

                const mockContext = new DummyOrchestrationContext();
                const orchestrationInput = new DurableOrchestrationInput(
                    "",
                    TestHistories.GetPendingHttpPollingRequest(moment.utc().toDate(), req, 30000),
                    req,
                    undefined,
                    undefined,
                    30000,
                    ReplaySchema.V3
                );

                const result = await orchestrator(orchestrationInput, mockContext);

                expect(result).to.be.deep.equal(
                    new OrchestratorState({
                        isDone: false,
                        output: undefined,
                        actions: [[new CallHttpAction(req)]],
                        schemaVersion: ReplaySchema.V3,
                    })
                );
            });
            it("defaults to polling", async () => {
                const orchestrator = TestOrchestrations.SendHttpRequest;
                const req = new DurableHttpRequest("GET", "https://bing.com");

                const redirectResponse = new DurableHttpResponse(202, "redirect", {
                    Location: "https://bing.com",
                });

                const mockContext = new DummyOrchestrationContext();
                const orchestrationInput = new DurableOrchestrationInput(
                    "",
                    TestHistories.GetSendHttpRequestReplayOne(
                        "SendHttpRequest",
                        moment.utc().toDate(),
                        req,
                        redirectResponse
                    ),
                    req,
                    undefined,
                    undefined,
                    30000,
                    ReplaySchema.V3
                );

                const result = await orchestrator(orchestrationInput, mockContext);

                expect(result).to.be.deep.equal(
                    new OrchestratorState({
                        isDone: false,
                        output: undefined,
                        actions: [[new CallHttpAction(req)]],
                        schemaVersion: ReplaySchema.V3,
                    })
                );
            });
            it("requires schema version V3", async () => {
                const orchestrator = TestOrchestrations.SendHttpRequest;
                const req = new DurableHttpRequest(
                    "GET",
                    "https://bing.com",
                    undefined,
                    undefined,
                    undefined,
                    true
                );

                const redirectResponse = new DurableHttpResponse(202, "redirect", {
                    Location: "https://bing.com",
                });

                const mockContext = new DummyOrchestrationContext();
                const orchestrationInput = new DurableOrchestrationInput(
                    "",
                    TestHistories.GetSendHttpRequestReplayOne(
                        "SendHttpRequest",
                        moment.utc().toDate(),
                        req,
                        redirectResponse
                    ),
                    req,
                    undefined,
                    undefined,
                    30000,
                    ReplaySchema.V1
                );

                const result = await orchestrator(orchestrationInput, mockContext);

                expect(result).to.be.deep.equal(
                    new OrchestratorState({
                        isDone: true,
                        output: redirectResponse,
                        actions: [[new CallHttpAction(req)]],
                        schemaVersion: ReplaySchema.V1,
                    })
                );
            });
            it("fails if a sub-HTTP request task fails", async () => {
                const orchestrator = TestOrchestrations.SendHttpRequest;
                const req = new DurableHttpRequest(
                    "GET",
                    "https://bing.com",
                    undefined,
                    undefined,
                    undefined,
                    true
                );

                const mockContext = new DummyOrchestrationContext();
                const orchestrationInput = new DurableOrchestrationInput(
                    "",
                    TestHistories.GetCallHttpWithPollingFailedRequest(
                        moment.utc().toDate(),
                        req,
                        30000
                    ),
                    req,
                    undefined,
                    undefined,
                    30000,
                    ReplaySchema.V3
                );

                let errored = false;
                try {
                    await orchestrator(orchestrationInput, mockContext);
                } catch (err) {
                    errored = true;
                    expect(err).to.be.an.instanceOf(OrchestrationFailureError);
                }
                expect(errored).to.be.true;
            });
            it("errors if V3 is used and defaultHttpAsyncRequestSleepTimeMillseconds is undefined", () => {
                const orchestrator = TestOrchestrations.SendHttpRequest;
                const req = new DurableHttpRequest(
                    "GET",
                    "https://bing.com",
                    undefined,
                    undefined,
                    undefined,
                    true
                );

                const mockContext = new DummyOrchestrationContext();
                const orchestrationInput = new DurableOrchestrationInput(
                    "",
                    TestHistories.GetCallHttpWithPollingFailedRequest(
                        moment.utc().toDate(),
                        req,
                        30000
                    ),
                    req,
                    undefined,
                    undefined,
                    undefined,
                    ReplaySchema.V3
                );

                expect(orchestrator(orchestrationInput, mockContext)).to.throw;
            });
        });
    });

    describe("callEntity()", () => {
        it("schedules an entity request", async () => {
            const orchestrator = TestOrchestrations.CallEntitySet; // TODO: finish
            const instanceId = uuidv1();
            const expectedEntity = new EntityId("StringStore2", "12345");
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetOrchestratorStart("CallEntityGet", moment.utc().toDate()),
                expectedEntity,
                instanceId
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: false,
                        output: undefined,
                        actions: [[new CallEntityAction(expectedEntity, "set", "testString")]],
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("handles a completed entity request", async () => {
            const orchestrator = TestOrchestrations.CallEntitySet;
            const instanceId = uuidv1();
            const expectedEntity = new EntityId("StringStore2", "12345");
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                instanceId,
                TestHistories.GetCallEntitySet(moment.utc().toDate(), expectedEntity),
                expectedEntity,
                undefined,
                undefined,
                undefined,
                ReplaySchema.V1,
                true
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: true,
                        actions: [[new CallEntityAction(expectedEntity, "set", "testString")]],
                        output: "OK",
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });
    });

    describe("signalEntity()", () => {
        it("scheduled a SignalEntity action", async () => {
            const orchestrator = TestOrchestrations.signalEntity;
            const entityName = "Counter";
            const id = "1234";
            const expectedEntity = new EntityId(entityName, id);
            const operationName = "add";
            const operationArgument = 1;
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetOrchestratorStart("signalEntity", new Date()),
                {
                    id,
                    entityName,
                    operationName,
                    operationArgument,
                }
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.deep.equal(
                new OrchestratorState(
                    {
                        isDone: true,
                        output: undefined,
                        actions: [
                            [
                                new SignalEntityAction(
                                    expectedEntity,
                                    operationName,
                                    operationArgument
                                ),
                            ],
                        ],
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("doesn't allow signalEntity() to be yielded", async () => {
            const orchestrator = TestOrchestrations.signalEntityYield;
            const entityName = "Counter";
            const id = "1234";
            const expectedEntity = new EntityId(entityName, id);
            const operationName = "add";
            const operationArgument = 1;
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetOrchestratorStart("signalEntity", new Date()),
                {
                    id,
                    entityName,
                    operationName,
                    operationArgument,
                }
            );

            let errored = false;
            try {
                await orchestrator(orchestrationInput, mockContext);
            } catch (err) {
                errored = true;
                const errorMsg =
                    `Durable Functions programming constraint violation: Orchestration yielded data of type undefined.` +
                    ' This is likely a result of yielding a "fire-and-forget API" such as signalEntity or continueAsNew.' +
                    " These APIs should not be yielded as they are not blocking operations. Please remove the yield statement preceding those invocations." +
                    " If you are not calling those APIs, please check your yield statements to make sure you only yield Task types resulting from calling Durable Functions APIs.";

                expect(err).to.be.an.instanceOf(OrchestrationFailureError);

                const orchestrationState = TestUtils.extractStateFromError(
                    err as OrchestrationFailureError
                );

                expect(orchestrationState)
                    .to.be.an("object")
                    .that.deep.include({
                        isDone: false,
                        actions: [
                            [
                                new SignalEntityAction(
                                    expectedEntity,
                                    operationName,
                                    operationArgument
                                ),
                            ],
                        ],
                        schemaVersion: ReplaySchema.V1,
                        error: errorMsg,
                    });
                expect(orchestrationState.error).to.include(errorMsg);
            }
            expect(errored).to.be.true;
        });
    });

    describe("callSubOrchestrator()", () => {
        it("schedules a suborchestrator function", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithSubOrchestrator;
            const name = "World";
            const id = uuidv1();
            const childId = `${id}:0`;
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                id,
                TestHistories.GetOrchestratorStart(
                    "SayHelloWithSubOrchestrator",
                    moment.utc().toDate()
                ),
                name
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: false,
                        output: undefined,
                        actions: [
                            [new CallSubOrchestratorAction("SayHelloWithActivity", childId, name)],
                        ],
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("schedules a suborchestrator function with no instanceId", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithSubOrchestratorNoSubId;
            const name = "World";
            const id = uuidv1();
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetOrchestratorStart(
                    "SayHelloWithSubOrchestrator",
                    moment.utc().toDate()
                ),
                name,
                id
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: false,
                        output: undefined,
                        actions: [
                            [
                                new CallSubOrchestratorAction(
                                    "SayHelloWithActivity",
                                    undefined,
                                    name
                                ),
                            ],
                        ],
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("Succesfully runs multiple suborchestrator function with no instanceId", async () => {
            const orchestrator = TestOrchestrations.MultipleSubOrchestratorNoSubId;
            const name = "World";
            const id = uuidv1();
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetMultipleSubOrchestratorNoIdsSubOrchestrationsFinished(
                    moment.utc().toDate(),
                    orchestrator,
                    [
                        "SayHelloWithActivity",
                        "SayHelloInline",
                        "SayHelloWithActivity",
                        "SayHelloInline",
                    ],
                    name
                ),
                name,
                id
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: true,
                        output: [
                            `Hello, ${name}_SayHelloWithActivity_0!`,
                            `Hello, ${name}_SayHelloInline_1!`,
                            `Hello, ${name}_SayHelloWithActivity_2!`,
                            `Hello, ${name}_SayHelloInline_3!`,
                        ],
                        actions: [
                            [
                                new CallSubOrchestratorAction(
                                    "SayHelloWithActivity",
                                    undefined,
                                    `${name}_SayHelloWithActivity_0`
                                ),
                                new CallSubOrchestratorAction(
                                    "SayHelloInline",
                                    undefined,
                                    `${name}_SayHelloInline_1`
                                ),
                                new CallSubOrchestratorAction(
                                    "SayHelloWithActivity",
                                    undefined,
                                    `${name}_SayHelloWithActivity_2`
                                ),
                                new CallSubOrchestratorAction(
                                    "SayHelloInline",
                                    undefined,
                                    `${name}_SayHelloInline_3`
                                ),
                            ],
                        ],
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("handles a completed suborchestrator function", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithSubOrchestrator;
            const name = "World";
            const id = uuidv1();
            const childId = `${id}:0`;
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                id,
                TestHistories.GetSayHelloWithSubOrchestratorReplayOne(
                    moment.utc().toDate(),
                    "SayHelloWithSubOrchestrator",
                    "SayHelloWithActivity",
                    childId,
                    name
                ),
                name
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: true,
                        actions: [
                            [new CallSubOrchestratorAction("SayHelloWithActivity", childId, name)],
                        ],
                        output: "Hello, World!",
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("reports an unhandled exception from suborchestrator", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithSubOrchestrator;
            const name = "World";
            const id = uuidv1();
            const childId = `${id}:0`;
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                id,
                TestHistories.GetSayHelloWithSubOrchestratorFail(
                    moment.utc().toDate(),
                    "SayHelloWithSubOrchestrator",
                    "SayHelloWithActivity",
                    childId,
                    name
                ),
                name
            );
            const expectedErr =
                "Sub orchestrator function 'SayHelloInline' failed: Result: Failure";

            let errored = false;
            try {
                await orchestrator(orchestrationInput, mockContext);
            } catch (err) {
                errored = true;
                expect(err).to.be.an.instanceOf(OrchestrationFailureError);

                const orchestrationState = TestUtils.extractStateFromError(
                    err as OrchestrationFailureError
                );

                expect(orchestrationState)
                    .to.be.an("object")
                    .that.deep.include({
                        isDone: false,
                        actions: [
                            [new CallSubOrchestratorAction("SayHelloWithActivity", childId, name)],
                        ],
                    });
                expect(orchestrationState.error).to.include(expectedErr);
            }
            expect(errored).to.be.true;
        });
    });

    describe("callSubOrchestratorWithRetry()", () => {
        it("reports an error when retryOptions is undefined", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithSubOrchestratorRetryNoOptions;
            const id = uuidv1();
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                id,
                TestHistories.GetOrchestratorStart(
                    "SayHelloWithSubOrchestratorRetryNoOptions",
                    moment.utc().toDate()
                ),
                undefined
            );
            const expectedErr =
                "retryOptions: Expected object of type RetryOptions but got undefined; are you missing properties?";

            let errored = false;
            try {
                await orchestrator(orchestrationInput, mockContext);
            } catch (err) {
                errored = true;
                expect(err).to.be.an.instanceOf(OrchestrationFailureError);

                const orchestrationState = TestUtils.extractStateFromError(
                    err as OrchestrationFailureError
                );

                expect(orchestrationState).to.be.an("object").that.deep.include({
                    isDone: false,
                    actions: [],
                });
                expect(orchestrationState.error).to.include(expectedErr);
            }
            expect(errored).to.be.true;
        });

        it("schedules a suborchestrator function", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithSubOrchestratorRetry;
            const name = "World";
            const id = uuidv1();
            const childId = `${id}:0`;
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                id,
                TestHistories.GetOrchestratorStart(
                    "SayHelloWithSubOrchestratorRetry",
                    moment.utc().toDate(),
                    name
                ),
                name
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: false,
                        output: undefined,
                        actions: [
                            [
                                new CallSubOrchestratorWithRetryAction(
                                    "SayHelloInline",
                                    new RetryOptions(10000, 2),
                                    name,
                                    childId
                                ),
                            ],
                        ],
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("schedules a suborchestrator function if < max attempts", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithSubOrchestratorRetry;
            const name = "World";
            const id = uuidv1();
            const childId = `${id}:0`;
            const retryOptions = new RetryOptions(10000, 2);
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                id,
                TestHistories.GetSayHelloWithSubOrchestratorRetryRetryOne(
                    moment.utc().toDate(),
                    childId,
                    name,
                    retryOptions.firstRetryIntervalInMilliseconds
                ),
                name
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: false,
                        output: undefined,
                        actions: [
                            [
                                new CallSubOrchestratorWithRetryAction(
                                    "SayHelloInline",
                                    retryOptions,
                                    name,
                                    childId
                                ),
                            ],
                        ],
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("retries a failed suborchestrator function if < max attempts", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithSubOrchestratorRetry;
            const name = "World";
            const id = uuidv1();
            const childId = `${id}:0`;
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                id,
                TestHistories.GetSayHelloWithSubOrchestratorRetryFailOne(
                    moment.utc().toDate(),
                    childId,
                    name
                ),
                name
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: false,
                        output: undefined,
                        actions: [
                            [
                                new CallSubOrchestratorWithRetryAction(
                                    "SayHelloInline",
                                    new RetryOptions(10000, 2),
                                    name,
                                    childId
                                ),
                            ],
                        ],
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("reports a failed suborchestrator function if >= max attempts", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithSubOrchestratorRetry;
            const name = "World";
            const id = uuidv1();
            const childId = `${id}:0`;
            const retryOptions = new RetryOptions(10000, 2);
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                id,
                TestHistories.GetSayHelloWithSubOrchestratorRetryRetryTwo(
                    moment.utc().toDate(),
                    childId,
                    name,
                    retryOptions.firstRetryIntervalInMilliseconds
                ),
                name
            );
            const expectedErr =
                "Sub orchestrator function 'SayHelloInline' failed: Result: Failure";

            let errored = false;
            try {
                await orchestrator(orchestrationInput, mockContext);
            } catch (err) {
                errored = true;
                expect(err).to.be.an.instanceOf(OrchestrationFailureError);

                const orchestrationState = TestUtils.extractStateFromError(
                    err as OrchestrationFailureError
                );

                expect(orchestrationState)
                    .to.be.an("object")
                    .that.deep.include({
                        isDone: false,
                        actions: [
                            [
                                new CallSubOrchestratorWithRetryAction(
                                    "SayHelloInline",
                                    new RetryOptions(10000, 2),
                                    name,
                                    childId
                                ),
                            ],
                        ],
                    });
                expect(orchestrationState.error).to.include(expectedErr);
            }
            expect(errored).to.be.true;
        });

        it("handles a completed suborchestrator function", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithSubOrchestratorRetry;
            const name = "World";
            const id = uuidv1();
            const childId = `${id}:0`;
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                id,
                TestHistories.GetSayHelloWithSubOrchestratorReplayOne(
                    moment.utc().toDate(),
                    "SayHelloWithSubOrchestratorRetry",
                    "SayHelloInline",
                    childId,
                    name
                ),
                name
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: true,
                        actions: [
                            [
                                new CallSubOrchestratorWithRetryAction(
                                    "SayHelloInline",
                                    new RetryOptions(10000, 2),
                                    name,
                                    childId
                                ),
                            ],
                        ],
                        output: `Hello, ${name}!`,
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("handles fan-out/fan-in", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithSubOrchestratorRetryFanout;
            const retryOptions = new RetryOptions(100, 5);
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetSayHelloWithSuborchestratorRetryFanout(
                    moment.utc().toDate(),
                    retryOptions.firstRetryIntervalInMilliseconds,
                    4
                ),
                undefined
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: true,
                        actions: [
                            [
                                new CallSubOrchestratorWithRetryAction(
                                    "SayHelloInline",
                                    new RetryOptions(100, 5),
                                    "Tokyo"
                                ),
                                new CallSubOrchestratorWithRetryAction(
                                    "SayHelloInline",
                                    new RetryOptions(100, 5),
                                    "Seattle"
                                ),
                            ],
                        ],
                        output: ["Hello, Tokyo!", "Hello, Seattle!"],
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });
    });

    describe("continueAsNew()", () => {
        it("schedules a continueAsNew request", async () => {
            const orchestrator = TestOrchestrations.ContinueAsNewCounter;
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetOrchestratorStart("ContinueAsNewCounter", moment.utc().toDate()),
                { value: 5 }
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        // Is Done needs to be marked as true for 1.8.0 and later to properly process continueAsNew
                        isDone: true,
                        output: 6,
                        actions: [[new ContinueAsNewAction({ value: 6 })]],
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });
    });

    describe("createTimer()", () => {
        it("schedules a timer", async () => {
            const orchestrator = TestOrchestrations.WaitOnTimer;
            const startTime = moment.utc().toDate();
            const fireAt = moment(startTime).add(5, "m").toDate();

            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetOrchestratorStart("WaitOnTimer", startTime),
                fireAt
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: false,
                        output: undefined,
                        actions: [[new CreateTimerAction(fireAt)]],
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("proceeds after a timer fires", async () => {
            const orchestrator = TestOrchestrations.WaitOnTimer;
            const startTimestamp = moment.utc().toDate();
            const fireAt = moment(startTimestamp).add(5, "m").toDate();

            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetWaitOnTimerFired(startTimestamp, fireAt),
                fireAt
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: true,
                        actions: [[new CreateTimerAction(fireAt)]],
                        output: "Timer fired!",
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        describe("long timers", () => {
            it("schedules long timers", async () => {
                const orchestrator = TestOrchestrations.WaitOnTimer;
                const startTime = moment.utc().toDate();
                const fireAt = moment(startTime).add(10, "d").toDate();

                const mockContext = new DummyOrchestrationContext();
                const orchestrationInput = new DurableOrchestrationInput(
                    "",
                    TestHistories.GetOrchestratorStart("WaitOnTimer", startTime),
                    fireAt,
                    "6.00:00:00",
                    "3.00:00:00",
                    30000,
                    ReplaySchema.V3
                );

                const result = await orchestrator(orchestrationInput, mockContext);

                expect(result).to.be.deep.equal(
                    new OrchestratorState(
                        {
                            isDone: false,
                            output: undefined,
                            actions: [[new CreateTimerAction(fireAt)]],
                            schemaVersion: ReplaySchema.V3,
                        },
                        true
                    )
                );
            });

            it("waits for sub-timers of long timer", async () => {
                const orchestrator = TestOrchestrations.WaitOnTimer;
                const startTime = moment.utc().toDate();
                const fireAt = moment(startTime).add(10, "days").toDate();

                const mockContext = new DummyOrchestrationContext();
                const orchestrationInput = new DurableOrchestrationInput(
                    "",
                    TestHistories.GetWaitOnLongTimerHalfway(startTime, fireAt),
                    fireAt,
                    "6.00:00:00",
                    "3.00:00:00",
                    30000,
                    ReplaySchema.V3
                );

                const result = await orchestrator(orchestrationInput, mockContext);

                expect(result).to.be.deep.equal(
                    new OrchestratorState(
                        {
                            isDone: false,
                            output: undefined,
                            actions: [[new CreateTimerAction(fireAt)]],
                            schemaVersion: ReplaySchema.V3,
                        },
                        true
                    )
                );
            });

            it("proceeds after long timer fires", async () => {
                const orchestrator = TestOrchestrations.WaitOnTimer;
                const startTimestamp = moment.utc().toDate();
                const fireAt = moment(startTimestamp).add(10, "d").toDate();

                const mockContext = new DummyOrchestrationContext();
                const orchestrationInput = new DurableOrchestrationInput(
                    "",
                    TestHistories.GetWaitOnTimerFired(startTimestamp, fireAt),
                    fireAt,
                    "6.00:00:00",
                    "3.00:00:00",
                    300000,
                    ReplaySchema.V3
                );

                const result = await orchestrator(orchestrationInput, mockContext);

                expect(result).to.deep.equal(
                    new OrchestratorState(
                        {
                            isDone: true,
                            actions: [[new CreateTimerAction(fireAt)]],
                            output: "Timer fired!",
                            schemaVersion: ReplaySchema.V3,
                        },
                        true
                    )
                );
            });
        });
    });

    describe("newGuid()", () => {
        it("generates consistent GUIDs", async () => {
            const orchestrator = TestOrchestrations.GuidGenerator;
            const currentUtcDateTime = moment.utc().toDate();
            const instanceId = uuidv1();

            const mockContext1 = new DummyOrchestrationContext();
            const orchestrationInput1 = new DurableOrchestrationInput(
                instanceId,
                TestHistories.GetOrchestratorStart("GuidGenerator", currentUtcDateTime)
            );
            const mockContext2 = new DummyOrchestrationContext();
            const orchestrationInput2 = new DurableOrchestrationInput(
                instanceId,
                TestHistories.GetOrchestratorStart("GuidGenerator", currentUtcDateTime)
            );

            const result1 = await orchestrator(orchestrationInput1, mockContext1);
            const result2 = await orchestrator(orchestrationInput2, mockContext2);

            expect(result1.isDone).to.equal(true);
            expect(result1).to.deep.equal(result2);
        });
    });

    describe.skip("isLocked()", () => {
        it("returns correct state when no locks are owned", async () => {
            const orchestrator = TestOrchestrations.CheckForLocksNone;
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetOrchestratorStart("CheckForLocksNone", moment.utc().toDate())
            );

            const expectedLockState = new LockState(false, [
                new EntityId("samplename", "samplekey"),
            ]);

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.deep.equal(
                new OrchestratorState(
                    {
                        isDone: true,
                        actions: [],
                        output: expectedLockState,
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it.skip("returns correct state when locks are owned", () => {
            // TODO: fill in
        });
    });

    describe("setCustomStatus()", () => {
        it("sets a custom status", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithCustomStatus;
            const name = "World!";
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetSayHelloWithActivityReplayOne(
                    "SayHelloWithCustomStatus",
                    moment.utc().toDate(),
                    name
                ),
                name
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.deep.eq(
                new OrchestratorState(
                    {
                        isDone: false,
                        output: undefined,
                        actions: [
                            [new CallActivityAction("Hello", "Tokyo")],
                            [new CallActivityAction("Hello", "Seattle")],
                        ],
                        customStatus: "Tokyo",
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });
    });

    describe("waitForExternalEvent()", () => {
        it("waits for an external event", async () => {
            const orchestrator = TestOrchestrations.WaitForExternalEvent;
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetOrchestratorStart("WaitForExternalEvent,", moment.utc().toDate()),
                undefined
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.deep.equal(
                new OrchestratorState(
                    {
                        isDone: false,
                        output: undefined,
                        actions: [
                            [
                                new WaitForExternalEventAction(
                                    "start",
                                    ExternalEventType.ExternalEvent
                                ),
                            ],
                        ],
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("proceeds when the correctly-named event is received", async () => {
            const orchestrator = TestOrchestrations.WaitForExternalEvent;
            const name = "Reykjavik";
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetWaitForExternalEventEventReceived(
                    moment.utc().toDate(),
                    "start",
                    name
                ),
                undefined
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.deep.equal(
                new OrchestratorState(
                    {
                        isDone: false,
                        output: undefined,
                        actions: [
                            [
                                new WaitForExternalEventAction(
                                    "start",
                                    ExternalEventType.ExternalEvent
                                ),
                            ],
                            [new CallActivityAction("Hello", name)],
                        ],
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("does not proceed when an incorrectly-named event is received", async () => {
            const orchestrator = TestOrchestrations.WaitForExternalEvent;
            const name = "Reykjavik";
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetWaitForExternalEventEventReceived(
                    moment.utc().toDate(),
                    "wrongEvent",
                    name
                ),
                undefined
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.deep.equal(
                new OrchestratorState(
                    {
                        isDone: false,
                        output: undefined,
                        actions: [
                            [
                                new WaitForExternalEventAction(
                                    "start",
                                    ExternalEventType.ExternalEvent
                                ),
                            ],
                        ],
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });
    });

    describe("Task.all() and Task.any()", () => {
        it("schedules a parallel set of tasks", async () => {
            const orchestrator = TestOrchestrations.FanOutFanInDiskUsage;
            const filePaths = ["file1.txt", "file2.png", "file3.csx"];
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetFanOutFanInDiskUsageReplayOne(moment.utc().toDate(), filePaths),
                "C:\\Dev"
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: false,
                        output: undefined,
                        actions: [
                            [new CallActivityAction("GetFileList", "C:\\Dev")],
                            filePaths.map((file) => new CallActivityAction("GetFileSize", file)),
                        ],
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("Task.all does not proceed if some parallel tasks have completed", async () => {
            const orchestrator = TestOrchestrations.FanOutFanInDiskUsage;
            const filePaths = ["file1.txt", "file2.png", "file3.csx"];
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetFanOutFanInDiskUsagePartComplete(moment.utc().toDate(), filePaths),
                "C:\\Dev"
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: false,
                        output: undefined,
                        actions: [
                            [new CallActivityAction("GetFileList", "C:\\Dev")],
                            filePaths.map((file) => new CallActivityAction("GetFileSize", file)),
                        ],
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("Task.all proceeds if all parallel tasks have completed", async () => {
            const orchestrator = TestOrchestrations.FanOutFanInDiskUsage;
            const filePaths = ["file1.txt", "file2.png", "file3.csx"];
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetFanOutFanInDiskUsageComplete(moment.utc().toDate(), filePaths),
                "C:\\Dev"
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: true,
                        actions: [
                            [new CallActivityAction("GetFileList", "C:\\Dev")],
                            filePaths.map((file) => new CallActivityAction("GetFileSize", file)),
                        ],
                        output: 6,
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("Task.all throws if a parallel task has faulted", async () => {
            const orchestrator = TestOrchestrations.FanOutFanInDiskUsage;
            const filePaths = ["file1.txt", "file2.png", "file3.csx"];
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetFanOutFanInDiskUsageFaulted(moment.utc().toDate(), filePaths),
                "C:\\Dev"
            );

            const expectedErr1 =
                "Activity function 'GetFileSize' failed: Could not find file file2.png";

            let errored = false;

            try {
                await orchestrator(orchestrationInput, mockContext);
            } catch (err) {
                errored = true;
                expect(err).to.be.an.instanceOf(OrchestrationFailureError);

                const orchestrationState = TestUtils.extractStateFromError(
                    err as OrchestrationFailureError
                );

                expect(orchestrationState).to.be.deep.include({
                    isDone: false,
                    actions: [
                        [new CallActivityAction("GetFileList", "C:\\Dev")],
                        filePaths.map((file) => new CallActivityAction("GetFileSize", file)),
                    ],
                });

                expect(orchestrationState.error).to.include(expectedErr1);
            }
            expect(errored).to.be.true;
        });

        it("Task.any proceeds if a scheduled parallel task completes in order", async () => {
            const orchestrator = TestOrchestrations.AnyAOrB;
            const completeInOrder = true;
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetAnyAOrB(moment.utc().toDate(), completeInOrder),
                completeInOrder
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: true,
                        actions: [
                            [
                                new CallActivityAction("TaskA", true),
                                new CallActivityAction("TaskB", true),
                            ],
                        ],
                        output: "A",
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("Task.any proceeds if a scheduled parallel task completes out of order", async () => {
            const orchestrator = TestOrchestrations.AnyAOrB;
            const completeInOrder = false;
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetAnyAOrB(moment.utc().toDate(), completeInOrder),
                completeInOrder
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: true,
                        actions: [
                            [
                                new CallActivityAction("TaskA", false),
                                new CallActivityAction("TaskB", false),
                            ],
                        ],
                        output: "B",
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("Task.any proceeds if a scheduled parallel task completes in order", async () => {
            const orchestrator = TestOrchestrations.AnyAOrB;
            const completeInOrder = true;
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetAnyAOrB(moment.utc().toDate(), completeInOrder),
                completeInOrder
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: true,
                        actions: [
                            [
                                new CallActivityAction("TaskA", true),
                                new CallActivityAction("TaskB", true),
                            ],
                        ],
                        output: "A",
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("Task.any called with one TaskSet and one timer where TaskSet wins", async () => {
            const orchestrator = TestOrchestrations.AnyWithTaskSet;
            const eventsWin = true;
            const initialTime = moment.utc().toDate();
            let mockContext = new DummyOrchestrationContext();
            let orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetAnyWithTaskSet(initialTime, 1, eventsWin)
            );

            let result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: false,
                        actions: [
                            [
                                new WaitForExternalEventAction("firstRequiredEvent"),
                                new WaitForExternalEventAction("secondRequiredEvent"),
                                new CreateTimerAction(moment(initialTime).add(300, "s").toDate()),
                            ],
                        ],
                        output: undefined,
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );

            mockContext = new DummyOrchestrationContext();
            orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetAnyWithTaskSet(initialTime, 2, eventsWin)
            );

            result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: false,
                        actions: [
                            [
                                new WaitForExternalEventAction("firstRequiredEvent"),
                                new WaitForExternalEventAction("secondRequiredEvent"),
                                new CreateTimerAction(moment(initialTime).add(300, "s").toDate()),
                            ],
                            [new CallActivityAction("Hello", "Tokyo")],
                        ],
                        output: undefined,
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("Task.any called with one TaskSet and one timer where timer wins", async () => {
            const orchestrator = TestOrchestrations.AnyWithTaskSet;
            const eventsWin = false;
            const initialTime = moment.utc().toDate();
            let mockContext = new DummyOrchestrationContext();
            let orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetAnyWithTaskSet(initialTime, 1, eventsWin)
            );

            let result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: false,
                        actions: [
                            [
                                new WaitForExternalEventAction("firstRequiredEvent"),
                                new WaitForExternalEventAction("secondRequiredEvent"),
                                new CreateTimerAction(moment(initialTime).add(300, "s").toDate()),
                            ],
                        ],
                        output: undefined,
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );

            mockContext = new DummyOrchestrationContext();
            orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetAnyWithTaskSet(initialTime, 2, eventsWin)
            );

            result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: true,
                        actions: [
                            [
                                new WaitForExternalEventAction("firstRequiredEvent"),
                                new WaitForExternalEventAction("secondRequiredEvent"),
                                new CreateTimerAction(moment(initialTime).add(300, "s").toDate()),
                            ],
                        ],
                        output: ["timeout"],
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("Task yielded in both Task.any() and afterwards scheduled only once", async () => {
            const orchestrator = TestOrchestrations.AnyAOrBYieldATwice;
            const completeInOrder = true;
            const mockContext = new DummyOrchestrationContext();
            const orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetAnyAOrB(moment.utc().toDate(), completeInOrder),
                completeInOrder
            );

            const result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: true,
                        actions: [
                            [
                                new CallActivityAction("TaskA", true),
                                new CallActivityAction("TaskB", true),
                            ],
                        ],
                        output: "A",
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("Timer in combination with Task.any() executes deterministically", async () => {
            const orchestrator = TestOrchestrations.TimerActivityRace;
            const currentTime = moment.utc().toDate();

            // first iteration
            let mockContext = new DummyOrchestrationContext();
            let orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetTimerActivityRaceActivityWinsHistory(currentTime, 1),
                undefined
            );

            let result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: false,
                        actions: [
                            [
                                new CreateTimerAction(moment(currentTime).add(1, "s").toDate()),
                                new CallActivityAction("TaskA"),
                            ],
                        ],
                        output: undefined,
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );

            // second iteration
            mockContext = new DummyOrchestrationContext();
            orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetTimerActivityRaceActivityWinsHistory(currentTime, 2),
                undefined
            );

            result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: false,
                        actions: [
                            [
                                new CreateTimerAction(moment(currentTime).add(1, "s").toDate()),
                                new CallActivityAction("TaskA"),
                            ],
                            [new CallActivityAction("TaskB")],
                        ],
                        output: undefined,
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );

            // third iteration
            mockContext = new DummyOrchestrationContext();
            orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetTimerActivityRaceActivityWinsHistory(currentTime, 3),
                undefined
            );

            result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: false,
                        actions: [
                            [
                                new CreateTimerAction(moment(currentTime).add(1, "s").toDate()),
                                new CallActivityAction("TaskA"),
                            ],
                            [new CallActivityAction("TaskB")],
                        ],
                        output: undefined,
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );

            // final iteration
            mockContext = new DummyOrchestrationContext();
            orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetTimerActivityRaceActivityWinsHistory(currentTime, 4),
                undefined
            );

            result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: true,
                        actions: [
                            [
                                new CreateTimerAction(moment(currentTime).add(1, "s").toDate()),
                                new CallActivityAction("TaskA"),
                            ],
                            [new CallActivityAction("TaskB")],
                        ],
                        output: {},
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("Timer in combination with Task.any() timer wins", async () => {
            const orchestrator = TestOrchestrations.TimerActivityRace;
            const currentTime = moment.utc().toDate();

            // first iteration
            let mockContext = new DummyOrchestrationContext();
            let orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetTimerActivityRaceTimerWinsHistory(currentTime, 1),
                null
            );

            let result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: false,
                        actions: [
                            [
                                new CreateTimerAction(moment(currentTime).add(1, "s").toDate()),
                                new CallActivityAction("TaskA"),
                            ],
                        ],
                        output: undefined,
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );

            // second iteration
            mockContext = new DummyOrchestrationContext();
            orchestrationInput = new DurableOrchestrationInput(
                "",
                TestHistories.GetTimerActivityRaceTimerWinsHistory(currentTime, 2),
                null
            );

            result = await orchestrator(orchestrationInput, mockContext);

            expect(result).to.be.deep.equal(
                new OrchestratorState(
                    {
                        isDone: true,
                        actions: [
                            [
                                new CreateTimerAction(moment(currentTime).add(1, "s").toDate()),
                                new CallActivityAction("TaskA"),
                            ],
                        ],
                        output: "Timer finished",
                        schemaVersion: ReplaySchema.V1,
                    },
                    true
                )
            );
        });

        it("doesn't allow compound tasks with no children", async () => {
            for (const orchestrator of [
                TestOrchestrations.TaskAllWithNoChildren,
                TestOrchestrations.TaskAnyWithNoChildren,
            ]) {
                const mockContext = new DummyOrchestrationContext();
                const orchestrationInput = new DurableOrchestrationInput(
                    "",
                    TestHistories.GetOrchestratorStart("CompoundTaskTest", moment().utc().toDate()),
                    undefined
                );

                const expectedErr =
                    "When constructing a CompoundTask (such as Task.all() or Task.any()), you must specify at least one Task.";

                let errored = false;
                try {
                    await orchestrator(orchestrationInput, mockContext);
                } catch (err) {
                    errored = true;
                    expect(err).to.be.an.instanceOf(OrchestrationFailureError);
                    const orchestrationState = TestUtils.extractStateFromError(
                        err as OrchestrationFailureError
                    );
                    expect(orchestrationState).to.be.an("object").that.deep.include({
                        isDone: false,
                        actions: [],
                    });
                    expect(orchestrationState.error).to.include(expectedErr);
                }

                expect(errored).to.be.true;
            }
        });
    });

    // rewind

    // extended sessions

    // ...
});
