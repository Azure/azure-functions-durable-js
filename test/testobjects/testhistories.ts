import * as moment from "moment";
import * as uuidv1 from "uuid/v1";
import { DurableHttpRequest, DurableHttpResponse, EntityId, EventRaisedEvent, EventSentEvent,
    ExecutionStartedEvent, HistoryEvent, OrchestratorCompletedEvent, OrchestratorStartedEvent,
    SubOrchestrationInstanceCompletedEvent, SubOrchestrationInstanceCreatedEvent,
    SubOrchestrationInstanceFailedEvent, TaskCompletedEvent, TaskFailedEvent, TaskScheduledEvent,
    TimerCreatedEvent, TimerFiredEvent } from "../../src/classes";

export class TestHistories {
    public static GetAnyAOrB(firstTimestamp: Date, completeInOrder: boolean): HistoryEvent[] {
        const firstMoment = moment(firstTimestamp);

        return [
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new ExecutionStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: true,
                    name: "AnyAOrB",
                    input: JSON.stringify(completeInOrder),
                },
            ),
            new TaskScheduledEvent(
                {
                    eventId: 0,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                    name: "TaskA",
                    input: JSON.stringify(completeInOrder),
                },
            ),
            new TaskScheduledEvent(
                {
                    eventId: 1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                    name: "TaskB",
                    input: JSON.stringify(completeInOrder),
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new TaskCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                    result: JSON.stringify(completeInOrder ? "A" : "B"),
                    taskScheduledId: completeInOrder ? 0 : 1,
                },
            ),
        ];
    }

    public static GetCallEntitySet(firstTimestamp: Date, entityId: EntityId) {
        const firstMoment = moment(firstTimestamp);
        const orchestratorId = uuidv1();
        const messageId = uuidv1();

        return [
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new ExecutionStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: true,
                    name: orchestratorId,
                    input: JSON.stringify(entityId),
                },
            ),
            new EventSentEvent(
                {
                    eventId: 0,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: true,
                    name: "op",
                    input: JSON.stringify({
                        id: messageId,
                        op: "set",
                        parent: orchestratorId,
                        timestamp: firstMoment.add(1, "s").toDate(),
                    }),
                    instanceId: EntityId.getSchedulerIdFromEntityId(entityId),
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: true,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(2, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new EventRaisedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(2, "s").toDate(),
                    isPlayed: false,
                    name: messageId,
                    input: JSON.stringify({
                        result: null,
                    }),
                },
            ),
        ];
    }

    public static GetFanOutFanInDiskUsageComplete(firstTimestamp: Date, files: string[]): HistoryEvent[] {
        const firstMoment = moment(firstTimestamp);

        return [
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new ExecutionStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: true,
                    name: "FanOutFanInDiskUsage",
                    input: undefined,
                },
            ),
            new TaskScheduledEvent(
                {
                    eventId: 0,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                    name: "GetFileList",
                    input: "C:\\Dev",
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new TaskCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                    result: JSON.stringify(files),
                    taskScheduledId: 0,
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(2, "s").toDate(),
                    isPlayed: false,
                },
            ),
        ].concat(files.map((file, index) => new TaskScheduledEvent(
            {
                eventId: index + 1,
                timestamp: firstMoment.add(2, "s").toDate(),
                isPlayed: false,
                name: "GetFileSize",
                input: file,
            },
        ))).concat(
        [
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(2, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new TaskCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(3, "s").toDate(),
                    isPlayed: false,
                    result: JSON.stringify(1),
                    taskScheduledId: 1,
                },
            ),
            new TaskCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(3, "s").toDate(),
                    isPlayed: false,
                    result: JSON.stringify(2),
                    taskScheduledId: 2,
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(4, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new TaskCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(4, "s").toDate(),
                    isPlayed: false,
                    result: JSON.stringify(3),
                    taskScheduledId: 3,
                },
            ),
        ]);
    }

    public static GetFanOutFanInDiskUsageFaulted(firstTimestamp: Date, files: string[]): HistoryEvent[] {
        const firstMoment = moment(firstTimestamp);

        return [
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new ExecutionStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: true,
                    name: "FanOutFanInDiskUsage",
                    input: undefined,
                },
            ),
            new TaskScheduledEvent(
                {
                    eventId: 0,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                    name: "GetFileList",
                    input: "C:\\Dev",
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new TaskCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                    result: JSON.stringify(files),
                    taskScheduledId: 0,
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(2, "s").toDate(),
                    isPlayed: false,
                },
            ),
        ].concat(files.map((file, index) => new TaskScheduledEvent(
            {
                eventId: index + 1,
                timestamp: firstMoment.add(2, "s").toDate(),
                isPlayed: false,
                name: "GetFileSize",
                input: file,
            },
        ))).concat(
        [
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(3, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new TaskCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(3, "s").toDate(),
                    isPlayed: false,
                    result: JSON.stringify(1),
                    taskScheduledId: 1,
                },
            ),
            new TaskCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(3, "s").toDate(),
                    isPlayed: false,
                    result: JSON.stringify(2),
                    taskScheduledId: 2,
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(4, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new TaskFailedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(4, "s").toDate(),
                    isPlayed: false,
                    taskScheduledId: 3,
                    reason: "Activity function 'GetFileSize' failed: Could not find file.",
                    details: "Serialized System.Exception here",
                },
            ),
        ]);
    }

    public static GetFanOutFanInDiskUsagePartComplete(firstTimestamp: Date, files: string[]): HistoryEvent[] {
        const firstMoment = moment(firstTimestamp);

        return [
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new ExecutionStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: true,
                    name: "FanOutFanInDiskUsage",
                    input: undefined,
                },
            ),
            new TaskScheduledEvent(
                {
                    eventId: 0,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                    name: "GetFileList",
                    input: "C:\\Dev",
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new TaskCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                    result: JSON.stringify(files),
                    taskScheduledId: 0,
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(2, "s").toDate(),
                    isPlayed: false,
                },
            ),
        ].concat(files.map((file, index) => new TaskScheduledEvent(
            {
                eventId: index + 1,
                timestamp: firstMoment.add(2, "s").toDate(),
                isPlayed: false,
                name: "GetFileSize",
                input: file,
            },
        ))).concat(
        [
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(3, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new TaskCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(3, "s").toDate(),
                    isPlayed: false,
                    result: JSON.stringify(2),
                    taskScheduledId: 2,
                },
            ),
        ]);
    }

    public static GetFanOutFanInDiskUsageReplayOne(firstTimestamp: Date, files: string[]): HistoryEvent[] {
        const firstMoment = moment(firstTimestamp);

        return [
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new ExecutionStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: true,
                    name: "FanOutFanInDiskUsage",
                    input: undefined,
                },
            ),
            new TaskScheduledEvent(
                {
                    eventId: 0,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                    name: "GetFileList",
                    input: "C:\\Dev",
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new TaskCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                    result: JSON.stringify(files),
                    taskScheduledId: 0,
                },
            ),
        ];
    }

    public static GetHelloSequenceReplayFinal(name: string, firstTimestamp: Date): HistoryEvent[] {
        const firstMoment = moment(firstTimestamp);

        return [
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new ExecutionStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: true,
                    name,
                    input: undefined,
                },
            ),
            new TaskScheduledEvent(
                {
                    eventId: 0,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                    name: "Hello",
                    input: null,
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new TaskCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: true,
                    result: JSON.stringify("Hello, Tokyo!"),
                    taskScheduledId: 0,
                },
            ),
            new TaskScheduledEvent(
                {
                    eventId: 1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                    name: "Hello",
                    input: null,
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(2, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new TaskCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(2, "s").toDate(),
                    isPlayed: true,
                    result: JSON.stringify("Hello, Seattle!"),
                    taskScheduledId: 1,
                },
            ),
            new TaskScheduledEvent(
                {
                    eventId: 2,
                    timestamp: firstMoment.add(2, "s").toDate(),
                    isPlayed: false,
                    name: "Hello",
                    input: null,
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(2, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new TaskCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(3, "s").toDate(),
                    isPlayed: true,
                    result: JSON.stringify("Hello, London!"),
                    taskScheduledId: 2,
                },
            ),
        ];
    }

    public static GetOrchestratorStart(name: string, firstTimestamp: Date, input?: unknown): HistoryEvent[] {
        return [
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new ExecutionStartedEvent(
                {
                    eventId: -1,
                    timestamp: moment(firstTimestamp).add(5, "ms").toDate(),
                    isPlayed: false,
                    name,
                    input: JSON.stringify(input),
                },
            ),
        ];
    }

    /**
     * This history and its corresponding orchestrator replicate conditions under
     * which there are not sufficient OrchestratorStartedEvents in the history
     * array to satisfy the currentUtcDateTime advancement logic.
     */
    public static GetTimestampExhaustion(firstTimestamp: Date): HistoryEvent[] {
        const firstTime = firstTimestamp.getTime();
        const timestamps: Date[] = [];
        for (let i = 0; i < 9; i++) {
            timestamps[i] = new Date(firstTime + 1000 * i);
        }

        return [
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[0],
                    isPlayed: false,
                },
            ),
            new ExecutionStartedEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[0],
                    isPlayed: true,
                    name: "TimestampExhaustion",
                    input: JSON.stringify({ delayMergeUntilSecs: 1 }),
                },
            ),
            new EventRaisedEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[0],
                    isPlayed: true,
                    name: "CheckPrForMerge",
                    input: JSON.stringify({ value: 0 }),
                },
            ),
            new TaskScheduledEvent(
                {
                    eventId: 0,
                    timestamp: timestamps[0],
                    isPlayed: false,
                    name: "Merge",
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[0],
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[1],
                    isPlayed: false,
                },
            ),
            new EventRaisedEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[1],
                    isPlayed: true,
                    name: "CheckPrForMerge",
                    input: JSON.stringify({ value: 1 }),
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[1],
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[2],
                    isPlayed: false,
                },
            ),
            new TaskCompletedEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[2],
                    isPlayed: true,
                    taskScheduledId: 0,
                    result: JSON.stringify(""),
                },
            ),
            new TimerCreatedEvent(
                {
                    eventId: 1,
                    timestamp: timestamps[2],
                    isPlayed: false,
                    fireAt: timestamps[2],
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[2],
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[3],
                    isPlayed: false,
                },
            ),
            new TimerFiredEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[3],
                    isPlayed: true,
                    fireAt: timestamps[2],
                    timerId: 1,
                },
            ),
            new TimerFiredEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[3],
                    isPlayed: true,
                    fireAt: timestamps[2],
                    timerId: 1,
                },
            ),
            new TaskScheduledEvent(
                {
                    eventId: 2,
                    timestamp: timestamps[3],
                    isPlayed: false,
                    name: "CheckIfMerged",
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[3],
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[4],
                    isPlayed: false,
                },
            ),
            new TaskCompletedEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[4],
                    isPlayed: true,
                    taskScheduledId: 2,
                    result: JSON.stringify({ output: false }),
                },
            ),
            new TaskScheduledEvent(
                {
                    eventId: 3,
                    timestamp: timestamps[4],
                    isPlayed: false,
                    name: "CheckIfMerged",
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[4],
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[5],
                    isPlayed: false,
                },
            ),
            new TaskCompletedEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[5],
                    isPlayed: true,
                    taskScheduledId: 3,
                    result: JSON.stringify({ output: false }),
                },
            ),
            new TaskScheduledEvent(
                {
                    eventId: 4,
                    timestamp: timestamps[5],
                    isPlayed: false,
                    name: "CheckIfMerged",
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[5],
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[6],
                    isPlayed: false,
                },
            ),
            new TaskCompletedEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[6],
                    isPlayed: true,
                    taskScheduledId: 4,
                    result: JSON.stringify({ output: false }),
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[6],
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[7],
                    isPlayed: false,
                },
            ),
            new EventRaisedEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[7],
                    isPlayed: true,
                    name: "CheckPrForMerge",
                    input: JSON.stringify({ value: 2 }),
                },
            ),
            new EventRaisedEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[7],
                    isPlayed: true,
                    name: "CheckPrForMerge",
                    input: JSON.stringify({ value: 3 }),
                },
            ),
            new EventRaisedEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[7],
                    isPlayed: true,
                    name: "CheckPrForMerge",
                    input: JSON.stringify({ value: 4 }),
                },
            ),
            new TaskScheduledEvent(
                {
                    eventId: 5,
                    timestamp: timestamps[7],
                    isPlayed: false,
                    name: "CheckIfMerged",
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[7],
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[8],
                    isPlayed: false,
                },
            ),
            new TaskCompletedEvent(
                {
                    eventId: -1,
                    timestamp: timestamps[8],
                    isPlayed: false,
                    taskScheduledId: 5,
                    result: JSON.stringify({ output: false }),
                },
            ),
        ];
    }

    public static GetSayHelloWithActivityReplayOne(
        name: string,
        firstTimestamp: Date,
        input: unknown)
        : HistoryEvent[] {
        const firstMoment = moment(firstTimestamp);

        return [
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new ExecutionStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: true,
                    name,
                    input: JSON.stringify(input),
                },
            ),
            new TaskScheduledEvent(
                {
                    eventId: 0,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                    name: "Hello",
                    input: JSON.stringify(input),
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new TaskCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                    result: JSON.stringify(`Hello, ${input}!`),
                    taskScheduledId: 0,
                },
            ),
        ];
    }

    public static GetSayHelloWithActivityRetryFailOne(firstTimestamp: Date, input: unknown): HistoryEvent[] {
        return [
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new ExecutionStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: true,
                    name: "SayHelloWithActivityRetry",
                    input: JSON.stringify(input),
                },
            ),
            new TaskScheduledEvent(
                {
                    eventId: 0,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                    name: "Hello",
                    input: undefined,
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: moment(firstTimestamp).add(1, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new TaskFailedEvent(
                {
                    eventId: -1,
                    timestamp: moment(firstTimestamp).add(1, "s").toDate(),
                    isPlayed: false,
                    taskScheduledId: 0,
                    details: "Big stack trace here",
                    reason: "Activity function 'Hello' failed: Result: Failure",
                },
            ),
        ];
    }

    public static GetSayHelloWithActivityRetryRetryOne(
        firstTimestamp: Date,
        input: unknown,
        retryInterval: number)
        : HistoryEvent[] {
        const firstMoment = moment(firstTimestamp);

        return [
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new ExecutionStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: true,
                    name: "SayHelloWithActivityRetry",
                    input: JSON.stringify(input),
                },
            ),
            new TaskScheduledEvent(
                {
                    eventId: 0,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                    name: "Hello",
                    input: undefined,
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new TaskFailedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                    taskScheduledId: 0,
                    details: "Big stack trace here",
                    reason: "Activity function 'Hello' failed: Result: Failure",
                },
            ),
            new TimerCreatedEvent(
                {
                    eventId: 1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                    fireAt: firstMoment.add(1, "s").add(retryInterval, "ms").toDate(),
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").add(retryInterval, "ms").toDate(),
                    isPlayed: false,
                },
            ),
            new TimerFiredEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").add(retryInterval, "ms").toDate(),
                    isPlayed: false,
                    fireAt: firstMoment.add(1, "s").add(retryInterval, "ms").toDate(),
                    timerId: 1,
                },
            ),
        ];
    }

    public static GetSayHelloWithActivityRetryRetryTwo(
        firstTimestamp: Date,
        input: unknown,
        retryInterval: number)
        : HistoryEvent[] {
        const firstMoment = moment(firstTimestamp);

        return [
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new ExecutionStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: true,
                    name: "SayHelloWithActivityRetry",
                    input: JSON.stringify(input),
                },
            ),
            new TaskScheduledEvent(
                {
                    eventId: 0,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                    name: "Hello",
                    input: undefined,
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new TaskFailedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                    taskScheduledId: 0,
                    details: "Big stack trace here",
                    reason: "Activity function 'Hello' failed: Result: Failure",
                },
            ),
            new TimerCreatedEvent(
                {
                    eventId: 1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                    fireAt: firstMoment.add(1, "s").add(retryInterval, "ms").toDate(),
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(2, "s").add(retryInterval, "ms").toDate(),
                    isPlayed: false,
                },
            ),
            new TimerFiredEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(2, "s").add(retryInterval, "ms").toDate(),
                    isPlayed: false,
                    fireAt: firstMoment.add(2, "s").add(retryInterval, "ms").toDate(),
                    timerId: 1,
                },
            ),
            new TaskScheduledEvent(
                {
                    eventId: 2,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                    name: "Hello",
                    input: undefined,
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(3, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new TaskFailedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(3, "s").toDate(),
                    isPlayed: false,
                    taskScheduledId: 2,
                    details: "Big stack trace here",
                    reason: "Activity function 'Hello' failed: Result: Failure",
                },
            ),
            new TimerCreatedEvent(
                {
                    eventId: 3,
                    timestamp: firstMoment.add(3, "s").toDate(),
                    isPlayed: false,
                    fireAt: firstMoment.add(3, "s").add(retryInterval, "ms").toDate(),
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(3, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(4, "s").add(retryInterval, "ms").toDate(),
                    isPlayed: false,
                },
            ),
            new TimerFiredEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(4, "s").add(retryInterval, "ms").toDate(),
                    isPlayed: false,
                    fireAt: firstMoment.add(4, "s").add(retryInterval, "ms").toDate(),
                    timerId: 3,
                },
            ),
        ];
    }

    public static GetSendHttpRequestReplayOne(
        name: string,
        firstTimestamp: Date,
        request: DurableHttpRequest,
        response: DurableHttpResponse)
        : HistoryEvent[] {
        const firstMoment = moment(firstTimestamp);

        return [
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new ExecutionStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: true,
                    name,
                    input: JSON.stringify(request),
                },
            ),
            new TaskScheduledEvent(
                {
                    eventId: 0,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                    name: "BuiltIn::HttpActivity",
                    input: JSON.stringify(request),
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new TaskCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                    result: JSON.stringify(response),
                    taskScheduledId: 0,
                },
            ),
        ];
    }

    public static GetSayHelloWithSubOrchestratorReplayOne(
        firstTimestamp: Date,
        orchestratorName: string,
        subOrchestratorName: string,
        subInstanceId: string,
        input?: string)
        : HistoryEvent[] {
        const firstMoment = moment(firstTimestamp);

        return [
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new ExecutionStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: true,
                    name: orchestratorName,
                    input,
                },
            ),
            new SubOrchestrationInstanceCreatedEvent(
                {
                    eventId: 0,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                    name: subOrchestratorName,
                    input,
                    instanceId: subInstanceId,
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new SubOrchestrationInstanceCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                    result: JSON.stringify(`Hello, ${input}!`),
                    taskScheduledId: 0,
                },
            ),
        ];
    }

    public static GetMultipleSubOrchestratorNoIdsSubOrchestrationsFinished(
        firstTimestamp: Date,
        orchestratorName: string,
        subOrchestratorNames: string[],
        input: string)
        : HistoryEvent[] {
        const firstMoment = moment(firstTimestamp);

        const baseSubInstanceId = "dummy-unique-id";
        const historyEvents =  [
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new ExecutionStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: true,
                    name: orchestratorName,
                    input,
                },
            )];
        for (let i = 0; i < subOrchestratorNames.length; i++) {
            historyEvents.push(new SubOrchestrationInstanceCreatedEvent(
                {
                    eventId: i,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                    name: subOrchestratorNames[i],
                    input: `${input}_${subOrchestratorNames[i]}_${i}`,
                    instanceId: `${baseSubInstanceId}_${i}`,
                },
            ));
        }
        historyEvents.push(
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                },
            ));

        for (let i = 0; i < subOrchestratorNames.length; i++) {
            historyEvents.push(new SubOrchestrationInstanceCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                    result: JSON.stringify(`Hello, ${input}_${subOrchestratorNames[i]}_${i}!`),
                    taskScheduledId: i,
                },
            ));
        }

        return historyEvents;
    }

    public static GetSayHelloWithSubOrchestratorFail(
        firstTimestamp: Date,
        orchestratorName: string,
        subOrchestratorName: string,
        subInstanceId: string,
        input?: string)
        : HistoryEvent[] {
        const firstMoment = moment(firstTimestamp);

        return [
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new ExecutionStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: true,
                    name: orchestratorName,
                    input,
                },
            ),
            new SubOrchestrationInstanceCreatedEvent(
                {
                    eventId: 0,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                    name: subOrchestratorName,
                    input,
                    instanceId: subInstanceId,
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new SubOrchestrationInstanceFailedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                    details: "Big stack trace here",
                    reason: "Sub orchestrator function 'SayHelloInline' failed: Result: Failure",
                    taskScheduledId: 0,
                },
            ),
        ];
    }

    public static GetSayHelloWithSubOrchestratorRetryFailOne(
        firstTimestamp: Date,
        subInstanceId: string,
        input: unknown)
        : HistoryEvent[] {
        return [
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new ExecutionStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: true,
                    name: "SayHelloWithSubOrchestratorRetry",
                    input: JSON.stringify(input),
                },
            ),
            new SubOrchestrationInstanceCreatedEvent(
                {
                    eventId: 0,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                    name: "SayHelloInline",
                    input: JSON.stringify(input),
                    instanceId: subInstanceId,
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: moment(firstTimestamp).add(1, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new SubOrchestrationInstanceFailedEvent(
                {
                    eventId: -1,
                    timestamp: moment(firstTimestamp).add(1, "s").toDate(),
                    isPlayed: false,
                    details: "Big stack trace here",
                    reason: "Sub orchestrator function 'SayHelloInline' failed: Result: Failure",
                    taskScheduledId: 0,
                },
            ),
        ];
    }

    public static GetSayHelloWithSubOrchestratorRetryRetryOne(
        firstTimestamp: Date,
        subInstanceId: string,
        input: string,
        retryInterval: number)
        : HistoryEvent[] {
        const firstMoment = moment(firstTimestamp);

        return [
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new ExecutionStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: true,
                    name: "SayHelloWithSubOrchestratorRetry",
                    input,
                },
            ),
            new SubOrchestrationInstanceCreatedEvent(
                {
                    eventId: 0,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                    name: "SayHelloInline",
                    input,
                    instanceId: subInstanceId,
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: moment(firstTimestamp).add(1, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new SubOrchestrationInstanceFailedEvent(
                {
                    eventId: -1,
                    timestamp: moment(firstTimestamp).add(1, "s").toDate(),
                    isPlayed: false,
                    details: "Big stack trace here",
                    reason: "Sub orchestrator function 'SayHelloInline' failed: Result: Failure",
                    taskScheduledId: 0,
                },
            ),
            new TimerCreatedEvent(
                {
                    eventId: 1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                    fireAt: firstMoment.add(1, "s").add(retryInterval, "ms").toDate(),
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").add(retryInterval, "ms").toDate(),
                    isPlayed: false,
                },
            ),
            new TimerFiredEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").add(retryInterval, "ms").toDate(),
                    isPlayed: false,
                    fireAt: firstMoment.add(1, "s").add(retryInterval, "ms").toDate(),
                    timerId: 1,
                },
            ),
        ];
    }

    public static GetSayHelloWithSubOrchestratorRetryRetryTwo(
        firstTimestamp: Date,
        subInstanceId: string,
        input: string,
        retryInterval: number)
        : HistoryEvent[] {
        const firstMoment = moment(firstTimestamp);

        return [
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new ExecutionStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: true,
                    name: "SayHelloWithSubOrchestratorRetry",
                    input,
                },
            ),
            new SubOrchestrationInstanceCreatedEvent(
                {
                    eventId: 0,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                    name: "SayHelloInline",
                    input,
                    instanceId: subInstanceId,
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: moment(firstTimestamp).add(1, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new SubOrchestrationInstanceFailedEvent(
                {
                    eventId: -1,
                    timestamp: moment(firstTimestamp).add(1, "s").toDate(),
                    isPlayed: false,
                    details: "Big stack trace here",
                    reason: "Sub orchestrator function 'SayHelloInline' failed: Result: Failure",
                    taskScheduledId: 0,
                },
            ),
            new TimerCreatedEvent(
                {
                    eventId: 1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                    fireAt: firstMoment.add(1, "s").add(retryInterval, "ms").toDate(),
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(2, "s").add(retryInterval, "ms").toDate(),
                    isPlayed: false,
                },
            ),
            new TimerFiredEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(2, "s").add(retryInterval, "ms").toDate(),
                    isPlayed: false,
                    fireAt: firstMoment.add(2, "s").add(retryInterval, "ms").toDate(),
                    timerId: 1,
                },
            ),
            new SubOrchestrationInstanceCreatedEvent(
                {
                    eventId: 2,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                    name: "SayHelloInline",
                    input,
                    instanceId: subInstanceId,
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: moment(firstTimestamp).add(3, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new SubOrchestrationInstanceFailedEvent(
                {
                    eventId: -1,
                    timestamp: moment(firstTimestamp).add(3, "s").toDate(),
                    isPlayed: false,
                    details: "Big stack trace here",
                    reason: "Sub orchestrator function 'SayHelloInline' failed: Result: Failure",
                    taskScheduledId: 2,
                },
            ),
            new TimerCreatedEvent(
                {
                    eventId: 3,
                    timestamp: firstMoment.add(3, "s").toDate(),
                    isPlayed: false,
                    fireAt: firstMoment.add(3, "s").add(retryInterval, "ms").toDate(),
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(3, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(4, "s").add(retryInterval, "ms").toDate(),
                    isPlayed: false,
                },
            ),
            new TimerFiredEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(4, "s").add(retryInterval, "ms").toDate(),
                    isPlayed: false,
                    fireAt: firstMoment.add(4, "s").add(retryInterval, "ms").toDate(),
                    timerId: 3,
                },
            ),
        ];
    }

    public static GetThrowsExceptionFromActivityReplayOne(firstTimestamp: Date): HistoryEvent[] {
        return [
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new ExecutionStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: true,
                    name: "DoesntHandleExceptionFromActivity",
                    input: undefined,
                },
            ),
            new TaskScheduledEvent(
                {
                    eventId: 0,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                    name: "ThrowsErrorActivity",
                    input: undefined,
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: moment(firstTimestamp).add(1, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new TaskFailedEvent(
                {
                    eventId: -1,
                    timestamp: moment(firstTimestamp).add(1, "s").toDate(),
                    isPlayed: false,
                    taskScheduledId: 0,
                    details: "Big stack trace here",
                    reason: "Activity function 'ThrowsErrorActivity' failed.",
                },
            ),
        ];
    }

    public static GetWaitForExternalEventEventReceived(
        firstTimestamp: Date,
        eventName: string,
        input?: unknown)
        : HistoryEvent[] {
        const firstMoment = moment(firstTimestamp);

        return [
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new ExecutionStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: true,
                    name: "WaitForExternalEvent",
                    input: JSON.stringify(input),
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                },
            ),
            new EventRaisedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(1, "s").toDate(),
                    isPlayed: false,
                    input: JSON.stringify(input),
                    name: eventName,
                },
            ),
        ];
    }

    public static GetWaitOnTimerFired(firstTimestamp: Date, fireAt: Date): HistoryEvent[] {
        return [
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new ExecutionStartedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: true,
                    name: "WaitOnTimer",
                    input: JSON.stringify(fireAt),
                },
            ),
            new TimerCreatedEvent(
                {
                    eventId: 0,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                    fireAt,
                },
            ),
            new OrchestratorCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstTimestamp,
                    isPlayed: false,
                },
            ),
            new OrchestratorStartedEvent(
                {
                    eventId: -1,
                    timestamp: fireAt,
                    isPlayed: false,
                },
            ),
            new TimerFiredEvent(
                {
                    eventId: -1,
                    timestamp: fireAt,
                    isPlayed: false,
                    fireAt,
                    timerId: 0,
                },
            ),
        ];
    }
}
