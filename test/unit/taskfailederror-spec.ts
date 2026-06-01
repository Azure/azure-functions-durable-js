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
import { TaskFailedEvent } from "../../src/history/TaskFailedEvent";
import { TaskScheduledEvent } from "../../src/history/TaskScheduledEvent";

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
});
