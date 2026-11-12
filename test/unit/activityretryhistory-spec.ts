import { expect } from "chai";
import { RetryOptions } from "../../src";
import { HistoryEvent } from "../../src/history/HistoryEvent";
import { HistoryEventType } from "../../src/history/HistoryEventType";
import { TaskCompletedEvent } from "../../src/history/TaskCompletedEvent";
import { TaskFailedEvent } from "../../src/history/TaskFailedEvent";
import { TaskScheduledEvent } from "../../src/history/TaskScheduledEvent";
import {
    createOrchestrator,
    DummyOrchestrationContext,
    DurableOrchestrationInput,
} from "../../src/util/testingUtils";
import { TestHistories } from "../testobjects/testhistories";

describe("Activity retry metadata in scheduled history", () => {
    const metadata = { AttemptNumber: 1, MaxAttempts: 2, RetryGroupId: "history-group" };

    it("preserves the PascalCase scheduled metadata through construction and serialization", () => {
        const event = new TaskScheduledEvent({
            eventId: 7,
            timestamp: new Date(),
            isPlayed: false,
            name: "Hello",
            retryMetadata: metadata,
        });
        expect(event.RetryMetadata).to.equal(metadata);
        expect(JSON.parse(JSON.stringify(event)).RetryMetadata).to.deep.equal(metadata);
    });

    it("leaves retry metadata absent for old or non-retry scheduled events", () => {
        const event = new TaskScheduledEvent({
            eventId: 7,
            timestamp: new Date(),
            isPlayed: false,
            name: "Hello",
        });
        expect(event).not.to.have.property("RetryMetadata");
        expect(JSON.parse(JSON.stringify(event))).not.to.have.property("RetryMetadata");
    });

    async function replay(history: HistoryEvent[]) {
        const orchestrator = createOrchestrator(function* (context) {
            try {
                return yield context.df.callActivityWithRetry(
                    "Hello",
                    new RetryOptions(10000, 2),
                    "World"
                );
            } catch (error) {
                return { failure: (error as Error).message };
            }
        });
        return orchestrator(
            new DurableOrchestrationInput("retry-instance", history, "World"),
            new DummyOrchestrationContext()
        );
    }

    for (const outcome of ["pending", "completed", "failed"]) {
        it(`preserves metadata during ${outcome} replay without changing task ID matching`, async () => {
            const history = TestHistories.GetSayHelloWithActivityRetryRetryTwo(
                new Date("2026-01-01T00:00:00Z"),
                "World",
                10000
            );
            const secondFailureIndex = history.findIndex(
                (event) => event instanceof TaskFailedEvent && event.TaskScheduledId === 2
            );
            const secondFailure = history[secondFailureIndex];
            if (outcome === "pending") {
                history.splice(secondFailureIndex);
            } else if (outcome === "completed") {
                history.splice(
                    secondFailureIndex,
                    history.length - secondFailureIndex,
                    new TaskCompletedEvent({
                        eventId: -1,
                        timestamp: secondFailure.Timestamp,
                        isPlayed: false,
                        taskScheduledId: 2,
                        result: JSON.stringify("Hello, World!"),
                    })
                );
            }

            const baseline = await replay(JSON.parse(JSON.stringify(history)));
            let attempt = 1;
            for (const event of history) {
                if (event instanceof TaskScheduledEvent) {
                    event.RetryMetadata = { ...metadata, AttemptNumber: attempt++ };
                }
            }
            // The extension delivers plain JSON objects, not history class instances.
            const wireHistory: HistoryEvent[] = JSON.parse(JSON.stringify(history));
            const scheduled = wireHistory.filter(
                (event): event is TaskScheduledEvent =>
                    event.EventType === HistoryEventType.TaskScheduled
            );
            const before = scheduled.map((event) => JSON.stringify(event.RetryMetadata));
            const result = await replay(wireHistory);
            expect(result).to.deep.equal(baseline);
            expect(scheduled.map((event) => JSON.stringify(event.RetryMetadata))).to.deep.equal(
                before
            );
            expect(scheduled.map((event) => event.EventId)).to.deep.equal([0, 2]);
            expect(scheduled.map((event) => event.RetryMetadata)).to.deep.equal([
                metadata,
                { ...metadata, AttemptNumber: 2 },
            ]);
            if (outcome === "pending") {
                expect(result.isDone).to.equal(false);
            } else if (outcome === "completed") {
                expect(result.isDone).to.equal(true);
                expect(result.output).to.equal("Hello, World!");
            } else {
                expect(result.isDone).to.equal(true);
                expect(result.output).to.have.property("failure").that.contains("Hello");
            }
            const repeated = await replay(JSON.parse(JSON.stringify(wireHistory)));
            expect(repeated).to.deep.equal(result);
        });
    }
});
