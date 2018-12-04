import * as moment from "moment";
import { EventRaisedEvent, ExecutionStartedEvent, HistoryEvent, OrchestratorCompletedEvent,
    OrchestratorStartedEvent, SubOrchestrationInstanceCompletedEvent, SubOrchestrationInstanceCreatedEvent,
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
            new TaskCompletedEvent(
                {
                    eventId: -1,
                    timestamp: firstMoment.add(3, "s").toDate(),
                    isPlayed: false,
                    result: JSON.stringify(3),
                    taskScheduledId: 3,
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
