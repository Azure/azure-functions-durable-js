/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { expect } from "chai";
import "mocha";
import * as moment from "moment";
import * as uuidv1 from "uuid/v1";
import { ManagedIdentityTokenSource } from "../../src";
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
    DurableOrchestrationBindingInfo,
    DurableOrchestrationContext,
    EntityId,
    ExternalEventType,
    HistoryEvent,
    IOrchestratorState,
    LockState,
    OrchestratorState,
    RetryOptions,
    WaitForExternalEventAction,
} from "../../src/classes";
import { OrchestrationFailureError } from "../../src/orchestrationfailureerror";
import { TestHistories } from "../testobjects/testhistories";
import { TestOrchestrations } from "../testobjects/TestOrchestrations";
import { TestUtils } from "../testobjects/testutils";

describe("Orchestrator", () => {
    const falsyValues = [false, 0, "", null, undefined, NaN];

    it("handles a simple orchestration function (no activity functions)", async () => {
        const orchestrator = TestOrchestrations.SayHelloInline;
        const name = "World";
        const mockContext = new MockContext({
            context: new DurableOrchestrationBindingInfo(
                TestHistories.GetOrchestratorStart("SayHelloInline", moment.utc().toDate(), name),
                name
            ),
        });
        orchestrator(mockContext);

        expect(mockContext.doneValue).to.be.deep.equal(
            new OrchestratorState({
                isDone: true,
                actions: [],
                output: `Hello, ${name}!`,
            })
        );
    });

    it("handles a simple orchestration function (no activity functions), with yield of non-Task object", async () => {
        const orchestrator = TestOrchestrations.SayHelloInlineInproperYield;
        const name = "World";
        const mockContext = new MockContext({
            context: new DurableOrchestrationBindingInfo(
                TestHistories.GetOrchestratorStart(
                    "SayHelloInlineInproperYield",
                    moment.utc().toDate(),
                    name
                ),
                name
            ),
        });
        orchestrator(mockContext);

        expect(mockContext.doneValue).to.be.deep.equal(
            new OrchestratorState({
                isDone: true,
                actions: [],
                output: `Hello, ${name}!`,
            })
        );
    });

    falsyValues.forEach(falsyValue => {
        it(`handles an orchestration function that returns ${
            falsyValue === "" ? "empty string" : falsyValue
        }`, async () => {
            const orchestrator = TestOrchestrations.PassThrough;
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetOrchestratorStart(
                        "PassThrough",
                        moment.utc().toDate(),
                        falsyValue
                    ),
                    falsyValue
                ),
            });
            orchestrator(mockContext);

            expect(mockContext.doneValue).to.deep.equal(
                new OrchestratorState({
                    isDone: true,
                    actions: [],
                    output: falsyValue,
                })
            );
            if (isNaN(falsyValue as number)) {
                expect(isNaN(mockContext.doneValue!.output as number)).to.equal(true);
            } else {
                expect(mockContext.doneValue!.output).to.equal(falsyValue);
            }
            expect(mockContext.err).to.equal(undefined);
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
                        name
                    ),
                    name,
                    id
                ),
            });
            orchestrator(mockContext);

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

            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(mockHistory, name),
            });

            orchestrator(mockContext);

            const lastEvent = mockHistory.pop() as HistoryEvent;

            expect(mockContext.df!.isReplaying).to.be.equal(lastEvent.IsPlayed);
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
                        name
                    ),
                    name,
                    undefined,
                    undefined,
                    id
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.df!.parentInstanceId).to.be.equal(id);
        });

        it("updates currentUtcDateTime to the most recent OrchestratorStarted timestamp", async () => {
            const orchestrator = TestOrchestrations.SayHelloSequence;
            const name = "World";
            const startTimestamp = moment.utc().toDate();
            const nextTimestamp = moment(startTimestamp)
                .add(1, "s")
                .toDate();

            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetSayHelloWithActivityReplayOne(
                        "SayHelloWithActivity",
                        startTimestamp,
                        name
                    ),
                    name
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.df!.currentUtcDateTime).to.be.deep.equal(nextTimestamp);
        });

        it("uses existing currentUtcDateTime if OrchestratorStarted events are exhausted", async () => {
            const orchestrator = TestOrchestrations.TimestampExhaustion;
            const startTimestamp = moment.utc().toDate();

            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetTimestampExhaustion(startTimestamp),
                    {
                        delayMergeUntilSecs: 1,
                    }
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue!.error).to.equal(undefined);

            expect(mockContext.err).to.equal(undefined);
        });
    });

    describe("Error Handling", () => {
        it("reports an unhandled exception from orchestrator", async () => {
            const orchestrator = TestOrchestrations.ThrowsExceptionInline;
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetOrchestratorStart(
                        "ThrowsExceptionInline",
                        moment.utc().toDate()
                    )
                ),
            });
            const expectedErr = "Exception from Orchestrator";

            orchestrator(mockContext);

            expect(mockContext.err).to.be.an.instanceOf(OrchestrationFailureError);

            const orchestrationState = TestUtils.extractStateFromError(
                mockContext.err as OrchestrationFailureError
            );

            expect(orchestrationState)
                .to.be.an("object")
                .that.deep.include({
                    isDone: false,
                    actions: [],
                });
            expect(orchestrationState.error).to.include(expectedErr);
        });

        it("reports an unhandled exception from activity passed through orchestrator", async () => {
            const orchestrator = TestOrchestrations.ThrowsExceptionFromActivity;
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetThrowsExceptionFromActivityReplayOne(moment.utc().toDate())
                ),
            });
            const expectedErr = "Activity function 'ThrowsErrorActivity' failed.";

            orchestrator(mockContext);

            expect(mockContext.err).to.be.an.instanceOf(OrchestrationFailureError);

            const orchestrationState = TestUtils.extractStateFromError(
                mockContext.err as OrchestrationFailureError
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
        });

        it("schedules an activity function after orchestrator catches an exception", async () => {
            const orchestrator = TestOrchestrations.ThrowsExceptionFromActivityWithCatch;
            const name = "World";
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetThrowsExceptionFromActivityReplayOne(moment.utc().toDate()),
                    name
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
                    actions: [
                        [new CallActivityAction("ThrowsErrorActivity")],
                        [new CallActivityAction("Hello", name)],
                    ],
                })
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
                        name
                    ),
                    name
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
                    actions: [[new CallActivityAction("Hello", name)]],
                })
            );
        });

        it("schedules an activity function with no input", async () => {
            const orchestrator = TestOrchestrations.CallActivityNoInput;
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetOrchestratorStart("CallActivityNoInput", moment.utc().toDate())
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
                    actions: [[new CallActivityAction("ReturnsFour")]],
                })
            );
        });

        describe("Falsy Input", () => {
            falsyValues.forEach(falsyValue => {
                it(`schedules an activity function with input ${falsyValue}`, async () => {
                    const orchestrator = TestOrchestrations.SayHelloWithActivity;
                    const mockContext = new MockContext({
                        context: new DurableOrchestrationBindingInfo(
                            TestHistories.GetOrchestratorStart(
                                "SayHelloWithActivity",
                                moment.utc().toDate(),
                                falsyValue
                            ),
                            falsyValue
                        ),
                    });

                    orchestrator(mockContext);

                    expect(mockContext.doneValue).to.be.deep.equal(
                        new OrchestratorState({
                            isDone: false,
                            output: undefined,
                            actions: [[new CallActivityAction("Hello", falsyValue)]],
                        })
                    );
                });

                it(`handles a completed activity function with falsy input ${falsyValue}`, async () => {
                    const orchestrator = TestOrchestrations.SayHelloWithActivity;
                    const mockContext = new MockContext({
                        context: new DurableOrchestrationBindingInfo(
                            TestHistories.GetSayHelloWithActivityReplayOne(
                                "SayHelloWithActivity",
                                moment.utc().toDate(),
                                falsyValue
                            ),
                            falsyValue
                        ),
                    });

                    orchestrator(mockContext);

                    expect(mockContext.doneValue).to.be.deep.equal(
                        new OrchestratorState({
                            isDone: true,
                            actions: [[new CallActivityAction("Hello", falsyValue)]],
                            output: `Hello, ${falsyValue}!`,
                        })
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
                        name
                    ),
                    name
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: true,
                    actions: [[new CallActivityAction("Hello", name)]],
                    output: `Hello, ${name}!`,
                })
            );
        });

        it("is yielded twice, only scheduled once", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithActivityYieldTwice;
            const name = "World";
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetSayHelloWithActivityReplayOne(
                        "CallActivityYieldTwice",
                        moment.utc().toDate(),
                        name
                    ),
                    name
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: true,
                    output: `Hello, ${name}!`,
                    actions: [[new CallActivityAction("Hello", name)]],
                })
            );
        });

        it("handles a completed activity function by returning instead of yielding", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithActivityDirectReturn;
            const name = "World";
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetSayHelloWithActivityReplayOne(
                        "SayHelloWithActivityDirectReturn",
                        moment.utc().toDate(),
                        name
                    ),
                    name
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: true,
                    actions: [[new CallActivityAction("Hello", name)]],
                    output: `Hello, ${name}!`,
                })
            );
        });

        it("handles a completed series of activity functions", async () => {
            const orchestrator = TestOrchestrations.SayHelloSequence;
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetHelloSequenceReplayFinal(
                        "SayHelloSequence",
                        moment.utc().toDate()
                    )
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: true,
                    actions: [
                        [new CallActivityAction("Hello", "Tokyo")],
                        [new CallActivityAction("Hello", "Seattle")],
                        [new CallActivityAction("Hello", "London")],
                    ],
                    output: ["Hello, Tokyo!", "Hello, Seattle!", "Hello, London!"],
                })
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
                        moment.utc().toDate()
                    )
                ),
            });
            const expectedErr =
                "retryOptions: Expected object of type RetryOptions but got undefined; are you missing properties?";

            orchestrator(mockContext);

            expect(mockContext.err).to.be.an.instanceOf(OrchestrationFailureError);

            expect(mockContext.err).to.be.an.instanceOf(OrchestrationFailureError);

            const orchestrationState = TestUtils.extractStateFromError(
                mockContext.err as OrchestrationFailureError
            );

            expect(orchestrationState)
                .to.be.an("object")
                .that.deep.include({
                    isDone: false,
                    actions: [],
                });
            expect(orchestrationState.error).to.include(expectedErr);
        });

        it("schedules an activity function", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithActivityRetry;
            const name = "World";
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetOrchestratorStart(
                        "SayHelloWithActivityRetry",
                        moment.utc().toDate(),
                        name
                    ),
                    name
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
                                name
                            ),
                        ],
                    ],
                })
            );
        });

        it("schedules an activity function if < max attempts", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithActivityRetry;
            const name = "World";
            const retryOptions = new RetryOptions(10000, 2);
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetSayHelloWithActivityRetryRetryOne(
                        moment.utc().toDate(),
                        name,
                        retryOptions.firstRetryIntervalInMilliseconds
                    ),
                    name
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
                    actions: [[new CallActivityWithRetryAction("Hello", retryOptions, name)]],
                })
            );
        });

        it("retries a failed activity function if < max attempts", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithActivityRetry;
            const name = "World";
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetSayHelloWithActivityRetryFailOne(moment.utc().toDate(), name),
                    name
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
                                name
                            ),
                        ],
                    ],
                })
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
                        retryOptions.firstRetryIntervalInMilliseconds
                    ),
                    name
                ),
            });
            const expectedErr = "Activity function 'Hello' failed: Result: Failure";

            orchestrator(mockContext);

            expect(mockContext.err).to.be.an.instanceOf(OrchestrationFailureError);

            const orchestrationState = TestUtils.extractStateFromError(
                mockContext.err as OrchestrationFailureError
            );

            expect(orchestrationState)
                .to.be.an("object")
                .that.deep.include({
                    isDone: false,
                    actions: [[new CallActivityWithRetryAction("Hello", retryOptions, name)]],
                });
            expect(orchestrationState.error).to.include(expectedErr);
        });

        it("handles a completed activity function", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithActivityRetry;
            const name = "World";
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetSayHelloWithActivityReplayOne(
                        "SayHelloWithActivityRetry",
                        moment.utc().toDate(),
                        name
                    ),
                    name
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
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
                })
            );
        });
    });

    describe("callHttp()", () => {
        it("schedules simple HTTP GET calls", async () => {
            const orchestrator = TestOrchestrations.SendHttpRequest;
            const req = new DurableHttpRequest("GET", "https://bing.com");
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetOrchestratorStart(
                        "SendHttpRequest",
                        moment.utc().toDate(),
                        req
                    ),
                    req
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
                    actions: [[new CallHttpAction(req)]],
                })
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
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetOrchestratorStart(
                        "SendHttpRequest",
                        moment.utc().toDate(),
                        req
                    ),
                    req
                ),
            });

            orchestrator(mockContext);

            // This is the exact protocol expected by the durable extension
            expect(mockContext.doneValue).to.be.deep.equal({
                isDone: false,
                output: undefined,
                actions: [
                    [
                        {
                            actionType: 8,
                            httpRequest: {
                                method: req.method,
                                uri: req.uri,
                                content: req.content,
                                headers: req.headers,
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
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetSendHttpRequestReplayOne(
                        "SendHttpRequest",
                        moment.utc().toDate(),
                        req,
                        res
                    ),
                    req
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: true,
                    actions: [[new CallHttpAction(req)]],
                    output: res,
                })
            );
        });
    });

    describe("callEntity()", () => {
        it("schedules an entity request", async () => {
            const orchestrator = TestOrchestrations.CallEntitySet; // TODO: finish
            const instanceId = uuidv1();
            const expectedEntity = new EntityId("StringStore2", "12345");
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetOrchestratorStart("CallEntityGet", moment.utc().toDate()),
                    expectedEntity,
                    instanceId
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
                    actions: [[new CallEntityAction(expectedEntity, "set", "testString")]],
                })
            );
        });

        it("handles a completed entity request", async () => {
            const orchestrator = TestOrchestrations.CallEntitySet;
            const instanceId = uuidv1();
            const expectedEntity = new EntityId("StringStore2", "12345");
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetCallEntitySet(moment.utc().toDate(), expectedEntity),
                    expectedEntity,
                    instanceId,
                    true
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: true,
                    actions: [[new CallEntityAction(expectedEntity, "set", "testString")]],
                    output: "OK",
                })
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
                        moment.utc().toDate()
                    ),
                    name,
                    id
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
                    actions: [
                        [new CallSubOrchestratorAction("SayHelloWithActivity", childId, name)],
                    ],
                })
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
                        moment.utc().toDate()
                    ),
                    name,
                    id
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
                    actions: [
                        [new CallSubOrchestratorAction("SayHelloWithActivity", undefined, name)],
                    ],
                })
            );
        });

        it("Succesfully runs multiple suborchestrator function with no instanceId", async () => {
            const orchestrator = TestOrchestrations.MultipleSubOrchestratorNoSubId;
            const name = "World";
            const id = uuidv1();
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
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
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
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
                })
            );
        });

        it("replay does not match history (mismatched suborchestration name) and throws error.", async () => {
            const orchestrator = TestOrchestrations.MultipleSubOrchestratorNoSubId;
            const name = "World";
            const id = uuidv1();
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetMultipleSubOrchestratorNoIdsSubOrchestrationsFinished(
                        moment.utc().toDate(),
                        orchestrator,
                        // The order in the sample suborchestrator is ["SayHelloWithActivity", "SayHelloInline", "SayHelloWithActivity", "SayHelloInline"]
                        [
                            "SayHelloInline",
                            "SayHelloWithActivity",
                            "SayHelloWithActivity",
                            "SayHelloInline",
                        ],
                        name
                    ),
                    name,
                    id
                ),
            });

            orchestrator(mockContext);

            const expectedErr =
                "The sub-orchestration call (n = 1) should be executed with a function name of SayHelloInline instead of the provided function name of SayHelloWithActivity. Check your code for non-deterministic behavior.";

            expect(mockContext.err).to.be.an.instanceOf(OrchestrationFailureError);

            const orchestrationState = TestUtils.extractStateFromError(
                mockContext.err as OrchestrationFailureError
            );

            expect(orchestrationState.error).to.include(expectedErr);
        });

        it("replay does not match history (mismatched suborchestration instance id) and throws error.", async () => {
            const orchestrator = TestOrchestrations.SayHelloWithSubOrchestrator;
            const name = "World";
            const id = uuidv1();
            const subId = id + ":1";
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetSayHelloWithSubOrchestratorReplayOne(
                        moment.utc().toDate(),
                        orchestrator,
                        "SayHelloWithActivity",
                        subId,
                        name
                    ),
                    name,
                    id
                ),
            });

            orchestrator(mockContext);

            const expectedErr = `The sub-orchestration call (n = 1) should be executed with an instance id of ${subId} instead of the provided instance id of ${id}:0. Check your code for non-deterministic behavior.`;

            expect(mockContext.err).to.be.an.instanceOf(OrchestrationFailureError);

            const orchestrationState = TestUtils.extractStateFromError(
                mockContext.err as OrchestrationFailureError
            );

            expect(orchestrationState.error).to.include(expectedErr);
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
                        name
                    ),
                    name,
                    id
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: true,
                    actions: [
                        [new CallSubOrchestratorAction("SayHelloWithActivity", childId, name)],
                    ],
                    output: "Hello, World!",
                })
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
                        name
                    ),
                    name,
                    id
                ),
            });
            const expectedErr =
                "Sub orchestrator function 'SayHelloInline' failed: Result: Failure";

            orchestrator(mockContext);

            expect(mockContext.err).to.be.an.instanceOf(OrchestrationFailureError);

            const orchestrationState = TestUtils.extractStateFromError(
                mockContext.err as OrchestrationFailureError
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
                        moment.utc().toDate()
                    ),
                    undefined,
                    id
                ),
            });
            const expectedErr =
                "retryOptions: Expected object of type RetryOptions but got undefined; are you missing properties?";

            orchestrator(mockContext);

            expect(mockContext.err).to.be.an.instanceOf(OrchestrationFailureError);

            const orchestrationState = TestUtils.extractStateFromError(
                mockContext.err as OrchestrationFailureError
            );

            expect(orchestrationState)
                .to.be.an("object")
                .that.deep.include({
                    isDone: false,
                    actions: [],
                });
            expect(orchestrationState.error).to.include(expectedErr);
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
                        name
                    ),
                    name,
                    id
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
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
                })
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
                        retryOptions.firstRetryIntervalInMilliseconds
                    ),
                    name,
                    id
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
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
                })
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
                        name
                    ),
                    name,
                    id
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
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
                })
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
                        retryOptions.firstRetryIntervalInMilliseconds
                    ),
                    name,
                    id
                ),
            });
            const expectedErr =
                "Sub orchestrator function 'SayHelloInline' failed: Result: Failure";

            orchestrator(mockContext);

            expect(mockContext.err).to.be.an.instanceOf(OrchestrationFailureError);

            const orchestrationState = TestUtils.extractStateFromError(
                mockContext.err as OrchestrationFailureError
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
                        name
                    ),
                    name,
                    id
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
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
                })
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
                        moment.utc().toDate()
                    ),
                    { value: 5 }
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    // Is Done needs to be marked as true for 1.8.0 and later to properly process continueAsNew
                    isDone: true,
                    output: undefined,
                    actions: [[new ContinueAsNewAction({ value: 6 })]],
                })
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
                    TestHistories.GetOrchestratorStart("WaitOnTimer", startMoment.toDate()),
                    fireAt
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
                    actions: [[new CreateTimerAction(fireAt)]],
                })
            );
        });

        it("proceeds after a timer fires", async () => {
            const orchestrator = TestOrchestrations.WaitOnTimer;
            const startTimestamp = moment.utc().toDate();
            const fireAt = moment(startTimestamp)
                .add(5, "m")
                .toDate();

            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetWaitOnTimerFired(startTimestamp, fireAt),
                    fireAt
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: true,
                    actions: [[new CreateTimerAction(fireAt)]],
                    output: "Timer fired!",
                })
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
                    TestHistories.GetOrchestratorStart("GuidGenerator", currentUtcDateTime),
                    undefined,
                    instanceId
                ),
            });
            const mockContext2 = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetOrchestratorStart("GuidGenerator", currentUtcDateTime),
                    undefined,
                    instanceId
                ),
            });

            orchestrator(mockContext1);
            orchestrator(mockContext2);

            expect(mockContext1.doneValue!.isDone).to.equal(true);
            expect(mockContext1.doneValue).to.deep.equal(mockContext2.doneValue);
        });
    });

    describe.skip("isLocked()", () => {
        it("returns correct state when no locks are owned", () => {
            const orchestrator = TestOrchestrations.CheckForLocksNone;
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetOrchestratorStart("CheckForLocksNone", moment.utc().toDate())
                ),
            });

            const expectedLockState = new LockState(false, [
                new EntityId("samplename", "samplekey"),
            ]);

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.deep.equal(
                new OrchestratorState({
                    isDone: true,
                    actions: [],
                    output: expectedLockState,
                })
            );
        });

        it.skip("returns correct state when locks are owned", () => {
            // TODO: fill in
        });
    });

    describe("newGuid()", () => {
        it("generates consistent GUIDs", () => {
            const orchestrator = TestOrchestrations.GuidGenerator;
            const currentUtcDateTime = moment.utc().toDate();
            const instanceId = uuidv1();

            const mockContext1 = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetOrchestratorStart("GuidGenerator", currentUtcDateTime),
                    undefined,
                    instanceId
                ),
            });
            const mockContext2 = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetOrchestratorStart("GuidGenerator", currentUtcDateTime),
                    undefined,
                    instanceId
                ),
            });

            orchestrator(mockContext1);
            orchestrator(mockContext2);

            expect(mockContext1.doneValue!.isDone).to.equal(true);
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
                        name
                    ),
                    name
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.deep.eq(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
                    actions: [
                        [new CallActivityAction("Hello", "Tokyo")],
                        [new CallActivityAction("Hello", "Seattle")],
                    ],
                    customStatus: "Tokyo",
                })
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
                        moment.utc().toDate()
                    ),
                    undefined
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
                    actions: [
                        [new WaitForExternalEventAction("start", ExternalEventType.ExternalEvent)],
                    ],
                })
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
                        name
                    ),
                    undefined
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
                    actions: [
                        [new WaitForExternalEventAction("start", ExternalEventType.ExternalEvent)],
                        [new CallActivityAction("Hello", name)],
                    ],
                })
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
                        name
                    ),
                    undefined
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
                    actions: [
                        [new WaitForExternalEventAction("start", ExternalEventType.ExternalEvent)],
                    ],
                })
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
                        filePaths
                    ),
                    "C:\\Dev"
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
                    actions: [
                        [new CallActivityAction("GetFileList", "C:\\Dev")],
                        filePaths.map(file => new CallActivityAction("GetFileSize", file)),
                    ],
                })
            );
        });

        it("Task.all does not proceed if some parallel tasks have completed", async () => {
            const orchestrator = TestOrchestrations.FanOutFanInDiskUsage;
            const filePaths = ["file1.txt", "file2.png", "file3.csx"];
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetFanOutFanInDiskUsagePartComplete(
                        moment.utc().toDate(),
                        filePaths
                    ),
                    "C:\\Dev"
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    output: undefined,
                    actions: [
                        [new CallActivityAction("GetFileList", "C:\\Dev")],
                        filePaths.map(file => new CallActivityAction("GetFileSize", file)),
                    ],
                })
            );
        });

        it("Task.all proceeds if all parallel tasks have completed", async () => {
            const orchestrator = TestOrchestrations.FanOutFanInDiskUsage;
            const filePaths = ["file1.txt", "file2.png", "file3.csx"];
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetFanOutFanInDiskUsageComplete(moment.utc().toDate(), filePaths),
                    "C:\\Dev"
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: true,
                    actions: [
                        [new CallActivityAction("GetFileList", "C:\\Dev")],
                        filePaths.map(file => new CallActivityAction("GetFileSize", file)),
                    ],
                    output: 6,
                })
            );
        });

        it("Task.all throws if a parallel task has faulted", async () => {
            const orchestrator = TestOrchestrations.FanOutFanInDiskUsage;
            const filePaths = ["file1.txt", "file2.png", "file3.csx"];
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetFanOutFanInDiskUsageFaulted(moment.utc().toDate(), filePaths),
                    "C:\\Dev"
                ),
            });

            const expectedErr1 =
                "Activity function 'GetFileSize' failed: Could not find file file2.png";
            const expectedErr2 =
                "Activity function 'GetFileSize' failed: Could not find file file3.csx";

            orchestrator(mockContext);

            expect(mockContext.err).to.be.an.instanceOf(OrchestrationFailureError);

            const orchestrationState = TestUtils.extractStateFromError(
                mockContext.err as OrchestrationFailureError
            );

            expect(orchestrationState).to.be.deep.include({
                isDone: false,
                actions: [
                    [new CallActivityAction("GetFileList", "C:\\Dev")],
                    filePaths.map(file => new CallActivityAction("GetFileSize", file)),
                ],
            });

            expect(orchestrationState.error).to.include(expectedErr1);
            expect(orchestrationState.error).to.include(expectedErr2);
        });

        it("Task.any proceeds if a scheduled parallel task completes in order", async () => {
            const orchestrator = TestOrchestrations.AnyAOrB;
            const completeInOrder = true;
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetAnyAOrB(moment.utc().toDate(), completeInOrder),
                    completeInOrder
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: true,
                    actions: [
                        [
                            new CallActivityAction("TaskA", true),
                            new CallActivityAction("TaskB", true),
                        ],
                    ],
                    output: "A",
                })
            );
        });

        it("Task.any proceeds if a scheduled parallel task completes out of order", async () => {
            const orchestrator = TestOrchestrations.AnyAOrB;
            const completeInOrder = false;
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetAnyAOrB(moment.utc().toDate(), completeInOrder),
                    completeInOrder
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: true,
                    actions: [
                        [
                            new CallActivityAction("TaskA", false),
                            new CallActivityAction("TaskB", false),
                        ],
                    ],
                    output: "B",
                })
            );
        });

        it("Task.any proceeds if a scheduled parallel task completes in order", async () => {
            const orchestrator = TestOrchestrations.AnyAOrB;
            const completeInOrder = true;
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetAnyAOrB(moment.utc().toDate(), completeInOrder),
                    completeInOrder
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: true,
                    actions: [
                        [
                            new CallActivityAction("TaskA", true),
                            new CallActivityAction("TaskB", true),
                        ],
                    ],
                    output: "A",
                })
            );
        });

        it("Task.any called with one TaskSet and one timer where TaskSet wins", async () => {
            const orchestrator = TestOrchestrations.AnyWithTaskSet;
            const eventsWin = true;
            const initialTime = moment.utc();
            let mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetAnyWithTaskSet(initialTime.toDate(), 1, eventsWin)
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    actions: [
                        [
                            new WaitForExternalEventAction("firstRequiredEvent"),
                            new WaitForExternalEventAction("secondRequiredEvent"),
                            new CreateTimerAction(initialTime.add(300, "s").toDate()),
                        ],
                    ],
                    output: undefined,
                })
            );

            mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetAnyWithTaskSet(initialTime.toDate(), 2, eventsWin)
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    actions: [
                        [
                            new WaitForExternalEventAction("firstRequiredEvent"),
                            new WaitForExternalEventAction("secondRequiredEvent"),
                            new CreateTimerAction(initialTime.add(300, "s").toDate()),
                        ],
                        [new CallActivityAction("Hello", "Tokyo")],
                    ],
                    output: undefined,
                })
            );
        });

        it("Task.any called with one TaskSet and one timer where timer wins", async () => {
            const orchestrator = TestOrchestrations.AnyWithTaskSet;
            const eventsWin = false;
            const initialTime = moment.utc();
            let mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetAnyWithTaskSet(initialTime.toDate(), 1, eventsWin)
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    actions: [
                        [
                            new WaitForExternalEventAction("firstRequiredEvent"),
                            new WaitForExternalEventAction("secondRequiredEvent"),
                            new CreateTimerAction(initialTime.add(300, "s").toDate()),
                        ],
                    ],
                    output: undefined,
                })
            );

            mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetAnyWithTaskSet(initialTime.toDate(), 2, eventsWin)
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: true,
                    actions: [
                        [
                            new WaitForExternalEventAction("firstRequiredEvent"),
                            new WaitForExternalEventAction("secondRequiredEvent"),
                            new CreateTimerAction(initialTime.add(300, "s").toDate()),
                        ],
                    ],
                    output: ["timeout"],
                })
            );
        });

        it("Task yielded in both Task.any() and afterwards scheduled only once", async () => {
            const orchestrator = TestOrchestrations.AnyAOrBYieldATwice;
            const completeInOrder = true;
            const mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetAnyAOrB(moment.utc().toDate(), completeInOrder),
                    completeInOrder
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: true,
                    actions: [
                        [
                            new CallActivityAction("TaskA", true),
                            new CallActivityAction("TaskB", true),
                        ],
                    ],
                    output: "A",
                })
            );
        });

        it("Timer in combination with Task.any() executes deterministically", async () => {
            const orchestrator = TestOrchestrations.TimerActivityRace;
            const currentTime = moment.utc();

            // first iteration
            let mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetTimerActivityRaceActivityWinsHistory(currentTime.toDate(), 1),
                    undefined
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    actions: [
                        [
                            new CreateTimerAction(currentTime.add(1, "s").toDate()),
                            new CallActivityAction("TaskA"),
                        ],
                    ],
                    output: undefined,
                })
            );

            // second iteration
            mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetTimerActivityRaceActivityWinsHistory(currentTime.toDate(), 2),
                    undefined
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    actions: [
                        [
                            new CreateTimerAction(currentTime.add(1, "s").toDate()),
                            new CallActivityAction("TaskA"),
                        ],
                        [new CallActivityAction("TaskB")],
                    ],
                    output: undefined,
                })
            );

            // third iteration
            mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetTimerActivityRaceActivityWinsHistory(currentTime.toDate(), 3),
                    undefined
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    actions: [
                        [
                            new CreateTimerAction(currentTime.add(1, "s").toDate()),
                            new CallActivityAction("TaskA"),
                        ],
                        [new CallActivityAction("TaskB")],
                    ],
                    output: undefined,
                })
            );

            // final iteration
            mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetTimerActivityRaceActivityWinsHistory(currentTime.toDate(), 4),
                    undefined
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: true,
                    actions: [
                        [
                            new CreateTimerAction(currentTime.add(1, "s").toDate()),
                            new CallActivityAction("TaskA"),
                        ],
                        [new CallActivityAction("TaskB")],
                    ],
                    output: {},
                })
            );
        });

        it("Timer in combination with Task.any() timer wins", async () => {
            const orchestrator = TestOrchestrations.TimerActivityRace;
            const currentTime = moment.utc();

            // first iteration
            let mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetTimerActivityRaceTimerWinsHistory(currentTime.toDate(), 1),
                    null
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: false,
                    actions: [
                        [
                            new CreateTimerAction(currentTime.add(1, "s").toDate()),
                            new CallActivityAction("TaskA"),
                        ],
                    ],
                    output: undefined,
                })
            );

            // second iteration
            mockContext = new MockContext({
                context: new DurableOrchestrationBindingInfo(
                    TestHistories.GetTimerActivityRaceTimerWinsHistory(currentTime.toDate(), 2),
                    null
                ),
            });

            orchestrator(mockContext);

            expect(mockContext.doneValue).to.be.deep.equal(
                new OrchestratorState({
                    isDone: true,
                    actions: [
                        [
                            new CreateTimerAction(currentTime.add(1, "s").toDate()),
                            new CallActivityAction("TaskA"),
                        ],
                    ],
                    output: "Timer finished",
                })
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
        public err?: Error | string | null
    ) {}

    public done(err?: Error | string | null, result?: IOrchestratorState): void {
        this.doneValue = result;
        this.err = err;
    }
}

interface IBindings {
    [key: string]: unknown;
}
