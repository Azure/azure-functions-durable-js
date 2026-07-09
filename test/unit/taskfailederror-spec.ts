import { expect } from "chai";
import "mocha";
import * as moment from "moment";

import {
    DummyOrchestrationContext,
    DurableOrchestrationInput,
    createOrchestrator,
} from "../../src/util/testingUtils";
import { TaskFailedError } from "../../src/error/TaskFailedError";
import { OrchestrationContext } from "durable-functions";
import { ExecutionStartedEvent } from "../../src/history/ExecutionStartedEvent";
import { OrchestratorStartedEvent } from "../../src/history/OrchestratorStartedEvent";
import { OrchestratorCompletedEvent } from "../../src/history/OrchestratorCompletedEvent";
import { TaskFailedEvent } from "../../src/history/TaskFailedEvent";
import { TaskScheduledEvent } from "../../src/history/TaskScheduledEvent";
import { SubOrchestrationInstanceCreatedEvent } from "../../src/history/SubOrchestrationInstanceCreatedEvent";
import { SubOrchestrationInstanceFailedEvent } from "../../src/history/SubOrchestrationInstanceFailedEvent";

describe("TaskFailedError (orchestrator replay)", () => {
    function buildHistory(failedEventOptions: ConstructorParameters<typeof TaskFailedEvent>[0]) {
        const t0 = moment.utc().toDate();
        const t1 = moment(t0).add(1, "s").toDate();
        return [
            new OrchestratorStartedEvent({ eventId: -1, timestamp: t0, isPlayed: false }),
            new ExecutionStartedEvent({
                eventId: -1,
                timestamp: t0,
                isPlayed: false,
                name: "TestOrch",
                input: undefined,
            }),
            new TaskScheduledEvent({
                eventId: 0,
                timestamp: t0,
                isPlayed: false,
                name: "Failing",
            }),
            new OrchestratorStartedEvent({ eventId: -1, timestamp: t1, isPlayed: false }),
            new TaskFailedEvent(failedEventOptions),
        ];
    }

    it("propagates a TaskFailedError carrying structured FailureDetails into the orchestrator", async () => {
        const history = buildHistory({
            eventId: -1,
            timestamp: moment.utc().toDate(),
            isPlayed: false,
            taskScheduledId: 0,
            reason: "legacy reason",
            details: "legacy details",
            failureDetails: {
                ErrorType: "MyError",
                ErrorMessage: "boom",
                StackTrace: "at activity\n at host",
                IsNonRetriable: false,
                Properties: { errorCode: 42, region: "westus2" },
            },
        });

        let caught: unknown;
        const orchestrator = createOrchestrator(function* (context: OrchestrationContext) {
            try {
                yield context.df.callActivity("Failing");
            } catch (err) {
                caught = err;
            }
            return undefined;
        });

        await orchestrator(
            new DurableOrchestrationInput("", history),
            new DummyOrchestrationContext()
        );

        expect(caught).to.be.instanceOf(TaskFailedError);
        const tfe = caught as TaskFailedError;
        expect(tfe.failureDetails.errorType).to.equal("MyError");
        expect(tfe.failureDetails.errorMessage).to.equal("boom");
        expect(tfe.failureDetails.isNonRetriable).to.equal(false);
        expect(tfe.failureDetails.properties).to.deep.equal({ errorCode: 42, region: "westus2" });
        expect(tfe.failureDetails.stackTrace).to.equal("at activity\n at host");
        expect(tfe.message).to.equal("MyError: boom");
        expect(tfe.stack).to.equal("at activity\n at host");
    });

    it("recursively reconstructs InnerFailure from the wire DTO", async () => {
        const history = buildHistory({
            eventId: -1,
            timestamp: moment.utc().toDate(),
            isPlayed: false,
            taskScheduledId: 0,
            reason: "outer",
            details: "outer details",
            failureDetails: {
                ErrorType: "OuterError",
                ErrorMessage: "outer",
                IsNonRetriable: true,
                InnerFailure: {
                    ErrorType: "InnerError",
                    ErrorMessage: "inner",
                    IsNonRetriable: false,
                    Properties: { cause: "io" },
                },
            },
        });

        let caught: unknown;
        const orchestrator = createOrchestrator(function* (context: OrchestrationContext) {
            try {
                yield context.df.callActivity("Failing");
            } catch (err) {
                caught = err;
            }
            return undefined;
        });

        await orchestrator(
            new DurableOrchestrationInput("", history),
            new DummyOrchestrationContext()
        );

        const tfe = caught as TaskFailedError;
        expect(tfe).to.be.instanceOf(TaskFailedError);
        expect(tfe.failureDetails.isNonRetriable).to.equal(true);
        expect(tfe.failureDetails.innerFailure?.errorType).to.equal("InnerError");
        expect(tfe.failureDetails.innerFailure?.properties).to.deep.equal({ cause: "io" });
    });

    it("surfaces the failed task's name and id on the TaskFailedError", async () => {
        const history = buildHistory({
            eventId: -1,
            timestamp: moment.utc().toDate(),
            isPlayed: false,
            taskScheduledId: 0,
            reason: "boom",
            details: "boom details",
            failureDetails: {
                ErrorType: "MyError",
                ErrorMessage: "boom",
                IsNonRetriable: false,
            },
        });

        let caught: unknown;
        const orchestrator = createOrchestrator(function* (context: OrchestrationContext) {
            try {
                yield context.df.callActivity("Failing");
            } catch (err) {
                caught = err;
            }
            return undefined;
        });

        await orchestrator(
            new DurableOrchestrationInput("", history),
            new DummyOrchestrationContext()
        );

        const tfe = caught as TaskFailedError;
        expect(tfe).to.be.instanceOf(TaskFailedError);
        expect(tfe.taskName).to.equal("Failing");
        expect(tfe.taskId).to.equal(0);
    });

    it("isCausedBy walks the failure and its InnerFailure chain by errorType", async () => {
        const history = buildHistory({
            eventId: -1,
            timestamp: moment.utc().toDate(),
            isPlayed: false,
            taskScheduledId: 0,
            reason: "outer",
            details: "outer details",
            failureDetails: {
                ErrorType: "OuterError",
                ErrorMessage: "outer",
                IsNonRetriable: true,
                InnerFailure: {
                    ErrorType: "InnerError",
                    ErrorMessage: "inner",
                    IsNonRetriable: false,
                    InnerFailure: {
                        ErrorType: "RootError",
                        ErrorMessage: "root",
                        IsNonRetriable: false,
                    },
                },
            },
        });

        let caught: unknown;
        const orchestrator = createOrchestrator(function* (context: OrchestrationContext) {
            try {
                yield context.df.callActivity("Failing");
            } catch (err) {
                caught = err;
            }
            return undefined;
        });

        await orchestrator(
            new DurableOrchestrationInput("", history),
            new DummyOrchestrationContext()
        );

        const tfe = caught as TaskFailedError;
        expect(tfe).to.be.instanceOf(TaskFailedError);
        // Matches the top-level failure.
        expect(tfe.failureDetails.isCausedBy("OuterError")).to.equal(true);
        // Matches nested failures in the chain.
        expect(tfe.failureDetails.isCausedBy("InnerError")).to.equal(true);
        expect(tfe.failureDetails.isCausedBy("RootError")).to.equal(true);
        // Does not match an absent error type.
        expect(tfe.failureDetails.isCausedBy("NotThere")).to.equal(false);
        // Works from a nested failure node as the starting point.
        expect(tfe.failureDetails.innerFailure?.isCausedBy("RootError")).to.equal(true);
        expect(tfe.failureDetails.innerFailure?.isCausedBy("OuterError")).to.equal(false);
    });

    it("falls back to a plain Error when FailureDetails is absent (legacy host)", async () => {
        const history = buildHistory({
            eventId: -1,
            timestamp: moment.utc().toDate(),
            isPlayed: false,
            taskScheduledId: 0,
            reason: "Activity 'Failing' failed",
            details: "Serialized exception here",
        });

        let caught: unknown;
        const orchestrator = createOrchestrator(function* (context: OrchestrationContext) {
            try {
                yield context.df.callActivity("Failing");
            } catch (err) {
                caught = err;
            }
            return undefined;
        });

        await orchestrator(
            new DurableOrchestrationInput("", history),
            new DummyOrchestrationContext()
        );

        expect(caught).to.be.instanceOf(Error);
        expect(caught).to.not.be.instanceOf(TaskFailedError);
        expect((caught as Error).message).to.contain("Activity 'Failing' failed");
        expect((caught as Error).message).to.contain("Serialized exception here");
    });

    it("propagates a failed activity's provider properties up to the parent orchestrator through a nested sub-orchestration's InnerFailure chain", async () => {
        // Mirrors durabletask-dotnet PR #482's NestedOrchestration test: a parent
        // orchestrator calls a sub-orchestrator, which calls an activity that throws
        // with custom provider properties. The host delivers the failure to the
        // parent as a SubOrchestrationInstanceFailed whose FailureDetails nests the
        // sub-orchestration failure, which in turn nests the original activity
        // failure carrying the provider Properties. This test verifies the JS worker
        // can reconstruct that chain so the parent can read the activity's properties.
        const t0 = moment.utc().toDate();
        const t1 = moment(t0).add(1, "s").toDate();
        const subInstanceId = "sub-instance-id";
        const history = [
            new OrchestratorStartedEvent({ eventId: -1, timestamp: t0, isPlayed: false }),
            new ExecutionStartedEvent({
                eventId: -1,
                timestamp: t0,
                isPlayed: false,
                name: "ParentOrch",
                input: undefined,
            }),
            new SubOrchestrationInstanceCreatedEvent({
                eventId: 0,
                timestamp: t0,
                isPlayed: false,
                name: "SubOrch",
                input: undefined,
                instanceId: subInstanceId,
            }),
            new OrchestratorCompletedEvent({ eventId: -1, timestamp: t0, isPlayed: false }),
            new OrchestratorStartedEvent({ eventId: -1, timestamp: t1, isPlayed: false }),
            new SubOrchestrationInstanceFailedEvent({
                eventId: -1,
                timestamp: t1,
                isPlayed: false,
                taskScheduledId: 0,
                reason: "Sub-orchestrator function 'SubOrch' failed",
                details: "legacy details",
                failureDetails: {
                    // Parent's view: the sub-orchestration failed.
                    ErrorType: "TaskFailedException",
                    ErrorMessage: "Sub-orchestrator function 'SubOrch' failed",
                    IsNonRetriable: false,
                    InnerFailure: {
                        // Sub-orchestration's view: its activity failed.
                        ErrorType: "TaskFailedException",
                        ErrorMessage: "Activity 'FailingActivity' failed",
                        IsNonRetriable: false,
                        InnerFailure: {
                            // Original activity exception, carrying provider properties.
                            ErrorType: "ArgumentOutOfRangeException",
                            ErrorMessage: "Nested parameter 'nestedParameter' is out of range.",
                            IsNonRetriable: false,
                            Properties: {
                                Name: "nestedParameter",
                                Value: "badNestedValue",
                            },
                        },
                    },
                },
            }),
        ];

        let caught: unknown;
        const orchestrator = createOrchestrator(function* (context: OrchestrationContext) {
            try {
                yield context.df.callSubOrchestrator("SubOrch", undefined, subInstanceId);
            } catch (err) {
                caught = err;
            }
            return undefined;
        });

        await orchestrator(
            new DurableOrchestrationInput("", history),
            new DummyOrchestrationContext()
        );

        expect(caught).to.be.instanceOf(TaskFailedError);
        const tfe = caught as TaskFailedError;

        // Parent level: sub-orchestration failure.
        expect(tfe.failureDetails.errorType).to.equal("TaskFailedException");

        // First inner level: the sub-orchestration's activity failure.
        const subFailure = tfe.failureDetails.innerFailure;
        expect(subFailure?.errorType).to.equal("TaskFailedException");

        // Second inner level: the original activity exception with provider properties.
        const activityFailure = subFailure?.innerFailure;
        expect(activityFailure?.errorType).to.equal("ArgumentOutOfRangeException");
        expect(activityFailure?.properties).to.deep.equal({
            Name: "nestedParameter",
            Value: "badNestedValue",
        });
    });

    it("emits structured failureDetails on the orchestrator state when a TaskFailedError propagates uncaught", async () => {
        const history = buildHistory({
            eventId: -1,
            timestamp: moment.utc().toDate(),
            isPlayed: false,
            taskScheduledId: 0,
            reason: "Activity 'Failing' failed",
            details: "legacy details",
            failureDetails: {
                ErrorType: "TaskFailedException",
                ErrorMessage: "Activity 'Failing' failed",
                IsNonRetriable: false,
                InnerFailure: {
                    ErrorType: "ArgumentOutOfRangeException",
                    ErrorMessage: "Parameter 'p' is out of range.",
                    IsNonRetriable: false,
                    Properties: { Name: "p", Value: "bad" },
                },
            },
        });

        // The orchestrator does NOT catch the failure, so it propagates out.
        const orchestrator = createOrchestrator(function* (context: OrchestrationContext) {
            yield context.df.callActivity("Failing");
            return undefined;
        });

        let caught: unknown;
        try {
            await orchestrator(
                new DurableOrchestrationInput("", history),
                new DummyOrchestrationContext()
            );
        } catch (err) {
            caught = err;
        }

        expect(caught).to.be.instanceOf(Error);
        const message = (caught as Error).message;
        const marker = "$OutOfProcData$:";
        const idx = message.indexOf(marker);
        expect(idx, "expected OutOfProcData state in error message").to.be.greaterThan(-1);
        const state = JSON.parse(message.substring(idx + marker.length));

        // Existing behavior preserved: the error string is still present.
        expect(state.error).to.be.a("string");
        // New behavior: structured, PascalCase failure details with the InnerFailure chain.
        expect(state.failureDetails).to.not.be.undefined;
        expect(state.failureDetails.ErrorType).to.equal("TaskFailedException");
        expect(state.failureDetails.InnerFailure.ErrorType).to.equal("ArgumentOutOfRangeException");
        expect(state.failureDetails.InnerFailure.Properties).to.deep.equal({
            Name: "p",
            Value: "bad",
        });
    });

    it("omits failureDetails on the orchestrator state for a plain (non-TaskFailedError) failure", async () => {
        const history = buildHistory({
            eventId: -1,
            timestamp: moment.utc().toDate(),
            isPlayed: false,
            taskScheduledId: 0,
            reason: "Activity 'Failing' failed",
            details: "Serialized exception here",
        });

        // No structured FailureDetails on the event -> the activity surfaces as a
        // plain Error; an orchestrator that rethrows must not gain a failureDetails field.
        const orchestrator = createOrchestrator(function* (context: OrchestrationContext) {
            yield context.df.callActivity("Failing");
            return undefined;
        });

        let caught: unknown;
        try {
            await orchestrator(
                new DurableOrchestrationInput("", history),
                new DummyOrchestrationContext()
            );
        } catch (err) {
            caught = err;
        }

        const message = (caught as Error).message;
        const marker = "$OutOfProcData$:";
        const state = JSON.parse(message.substring(message.indexOf(marker) + marker.length));

        expect(state.error).to.be.a("string");
        // eslint-disable-next-line no-prototype-builtins
        expect(state.hasOwnProperty("failureDetails")).to.equal(false);
    });
});
