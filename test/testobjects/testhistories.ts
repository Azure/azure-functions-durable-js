import * as moment from "moment";
import { HistoryEvent, HistoryEventType } from "../../src/classes";
import { HistoryEventFactory } from "./historyeventfactory";

export class TestHistories {
    public static GetAnyAOrB(firstTimestamp: Date, completeInOrder: boolean) {
        const firstMoment = moment(firstTimestamp);

        return [
            HistoryEventFactory.GetOrchestratorStarted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetExecutionStarted(
                firstTimestamp,
                true,
                "AnyAOrB",
                completeInOrder,
            ),
            HistoryEventFactory.GetTaskScheduled(
                0,
                firstTimestamp,
                false,
                "TaskA",
                JSON.stringify(!completeInOrder),
            ),
            HistoryEventFactory.GetTaskScheduled(
                1,
                firstTimestamp,
                false,
                "TaskB",
                JSON.stringify(completeInOrder),
            ),
            HistoryEventFactory.GetOrchestratorCompleted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetOrchestratorStarted(
                firstMoment.add(1, "s").toDate(),
                false,
            ),
            HistoryEventFactory.GetTaskCompleted(
                firstMoment.add(1, "s").toDate(),
                false,
                completeInOrder ? JSON.stringify("A") : JSON.stringify("B"),
                completeInOrder ? 0 : 1,
            ),
        ];
    }

    public static GetFanOutFanInDiskUsageComplete(firstTimestamp: Date, files: string[]) {
        const firstMoment = moment(firstTimestamp);

        return [
            HistoryEventFactory.GetOrchestratorStarted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetExecutionStarted(
                firstTimestamp,
                true,
                "FanOutFanInDiskUsage",
                undefined,
            ),
            HistoryEventFactory.GetTaskScheduled(
                0,
                firstTimestamp,
                false,
                "GetFileList",
                "C:\\Dev",
            ),
            HistoryEventFactory.GetOrchestratorCompleted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetOrchestratorStarted(
                firstMoment.add(1, "s").toDate(),
                false,
            ),
            HistoryEventFactory.GetTaskCompleted(
                firstMoment.add(1, "s").toDate(),
                false,
                JSON.stringify(files),
                0,
            ),
            HistoryEventFactory.GetOrchestratorCompleted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetOrchestratorStarted(
                firstMoment.add(2, "s").toDate(),
                false,
            ),
        ].concat(files.map((file, index) => HistoryEventFactory.GetTaskScheduled(
            index + 1,
            firstMoment.add(2, "s").toDate(),
            false,
            "GetFileSize",
            file)),
        ).concat(
        [
            HistoryEventFactory.GetOrchestratorCompleted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetOrchestratorStarted(
                firstMoment.add(3, "s").toDate(),
                false,
            ),
            HistoryEventFactory.GetTaskCompleted(
                firstMoment.add(3, "s").toDate(),
                false,
                JSON.stringify(1),
                1,
            ),
            HistoryEventFactory.GetTaskCompleted(
                firstMoment.add(3, "s").toDate(),
                false,
                JSON.stringify(2),
                2,
            ),
            HistoryEventFactory.GetTaskCompleted(
                firstMoment.add(3, "s").toDate(),
                false,
                JSON.stringify(3),
                3,
            ),
        ]);
    }

    public static GetFanOutFanInDiskUsagePartComplete(firstTimestamp: Date, files: string[]) {
        const firstMoment = moment(firstTimestamp);

        return [
            HistoryEventFactory.GetOrchestratorStarted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetExecutionStarted(
                firstTimestamp,
                true,
                "FanOutFanInDiskUsage",
                undefined,
            ),
            HistoryEventFactory.GetTaskScheduled(
                0,
                firstTimestamp,
                false,
                "GetFileList",
                "C:\\Dev",
            ),
            HistoryEventFactory.GetOrchestratorCompleted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetOrchestratorStarted(
                firstMoment.add(1, "s").toDate(),
                false,
            ),
            HistoryEventFactory.GetTaskCompleted(
                firstMoment.add(1, "s").toDate(),
                false,
                JSON.stringify(files),
                0,
            ),
            HistoryEventFactory.GetOrchestratorCompleted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetOrchestratorStarted(
                firstMoment.add(2, "s").toDate(),
                false,
            ),
        ].concat(files.map((file, index) => HistoryEventFactory.GetTaskScheduled(
            index + 1,
            firstMoment.add(2, "s").toDate(),
            false,
            "GetFileSize",
            file)),
        ).concat(
        [
            HistoryEventFactory.GetOrchestratorCompleted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetOrchestratorStarted(
                firstMoment.add(3, "s").toDate(),
                false,
            ),
            HistoryEventFactory.GetTaskCompleted(
                firstMoment.add(3, "s").toDate(),
                false,
                JSON.stringify(2),
                2,
            ),
        ]);
    }

    public static GetFanOutFanInDiskUsageReplayOne(firstTimestamp: Date, files: string[]) {
        const firstMoment = moment(firstTimestamp);

        return [
            HistoryEventFactory.GetOrchestratorStarted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetExecutionStarted(
                firstTimestamp,
                true,
                "FanOutFanInDiskUsage",
                undefined,
            ),
            HistoryEventFactory.GetTaskScheduled(
                0,
                firstTimestamp,
                false,
                "GetFileList",
                "C:\\Dev",
            ),
            HistoryEventFactory.GetOrchestratorCompleted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetOrchestratorStarted(
                firstMoment.add(1, "s").toDate(),
                false,
            ),
            HistoryEventFactory.GetTaskCompleted(
                firstMoment.add(1, "s").toDate(),
                false,
                JSON.stringify(files),
                0,
            ),
        ];
    }

    public static GetHelloSequenceReplayFinal(name: string, firstTimestamp: Date) {
        const firstMoment = moment(firstTimestamp);

        return [
            HistoryEventFactory.GetOrchestratorStarted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetExecutionStarted(
                firstTimestamp,
                true,
                name,
                undefined,
            ),
            HistoryEventFactory.GetTaskScheduled(
                0,
                firstTimestamp,
                false,
                "Hello",
                null,
            ),
            HistoryEventFactory.GetOrchestratorCompleted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetOrchestratorStarted(
                firstMoment.add(1, "s").toDate(),
                false,
            ),
            HistoryEventFactory.GetTaskCompleted(
                firstMoment.add(1, "s").toDate(),
                true,
                JSON.stringify("Hello, Tokyo!"),
                0,
            ),
            HistoryEventFactory.GetTaskScheduled(
                1,
                firstMoment.add(1, "s").toDate(),
                false,
                "Hello",
                null,
            ),
            HistoryEventFactory.GetOrchestratorCompleted(
                firstMoment.add(1, "s").toDate(),
                false,
            ),
            HistoryEventFactory.GetOrchestratorStarted(
                firstMoment.add(2, "s").toDate(),
                false,
            ),
            HistoryEventFactory.GetTaskCompleted(
                firstMoment.add(2, "s").toDate(),
                true,
                JSON.stringify("Hello, Seattle!"),
                1,
            ),
            HistoryEventFactory.GetTaskScheduled(
                2,
                firstMoment.add(2, "s").toDate(),
                false,
                "Hello",
                null,
            ),
            HistoryEventFactory.GetOrchestratorCompleted(
                firstMoment.add(2, "s").toDate(),
                false,
            ),
            HistoryEventFactory.GetOrchestratorStarted(
                firstMoment.add(3, "s").toDate(),
                false,
            ),
            HistoryEventFactory.GetTaskCompleted(
                firstMoment.add(3, "s").toDate(),
                true,
                JSON.stringify("Hello, London!"),
                2,
            ),
        ];
    }

    public static GetOrchestratorStart(name: string, firstTimestamp: Date, input?: any) {
        return [
            HistoryEventFactory.GetOrchestratorStarted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetExecutionStarted(
                moment(firstTimestamp).add(5, "ms").toDate(),
                false,
                name,
                input),
        ];
    }

    public static GetSayHelloWithActivityReplayOne(name: string, firstTimestamp: Date, input: any) {
        const firstMoment = moment(firstTimestamp);

        return [
            HistoryEventFactory.GetOrchestratorStarted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetExecutionStarted(
                firstTimestamp,
                true,
                name,
                input,
            ),
            HistoryEventFactory.GetTaskScheduled(
                0,
                firstTimestamp,
                false,
                "Hello",
                input,
            ),
            HistoryEventFactory.GetOrchestratorCompleted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetOrchestratorStarted(
                firstMoment.add(1, "s").toDate(),
                false,
            ),
            HistoryEventFactory.GetTaskCompleted(
                firstMoment.add(1, "s").toDate(),
                false,
                JSON.stringify(`Hello, ${input}!`),
                0,
            ),
        ];
    }

    public static GetSayHelloWithActivityRetryFailOne(firstTimestamp: Date, input: any) {
        return [
            HistoryEventFactory.GetOrchestratorStarted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetExecutionStarted(
                firstTimestamp,
                true,
                "SayHelloWithActivityRetry",
                input,
            ),
            HistoryEventFactory.GetTaskScheduled(
                0,
                firstTimestamp,
                false,
                "Hello",
                undefined,
            ),
            HistoryEventFactory.GetOrchestratorCompleted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetOrchestratorStarted(
                moment(firstTimestamp).add(1, "s").toDate(),
                false,
            ),
            HistoryEventFactory.GetTaskFailed(
                moment(firstTimestamp).add(1, "s").toDate(),
                false,
                0,
                "Big stack trace here",
                "Activity function 'Hello' failed: Result: Failure",
            ),
        ];
    }

    public static GetSayHelloWithActivityRetryRetryOne(firstTimestamp: Date, input: any, retryInterval: number) {
        const firstMoment = moment(firstTimestamp);

        return [
            HistoryEventFactory.GetOrchestratorStarted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetExecutionStarted(
                firstTimestamp,
                true,
                "SayHelloWithActivityRetry",
                input,
            ),
            HistoryEventFactory.GetTaskScheduled(
                0,
                firstTimestamp,
                false,
                "Hello",
                undefined,
            ),
            HistoryEventFactory.GetOrchestratorCompleted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetOrchestratorStarted(
                firstMoment.add(1, "s").toDate(),
                false,
            ),
            HistoryEventFactory.GetTaskFailed(
                firstMoment.add(1, "s").toDate(),
                true,
                0,
                "Big stack trace here",
                "Activity function 'Hello' failed: Result: Failure",
            ),
            HistoryEventFactory.GetTimerCreated(
                1,
                firstMoment.add(1, "s").toDate(),
                false,
                firstMoment.add(1, "s").add(retryInterval, "ms").toDate(),
            ),
            HistoryEventFactory.GetOrchestratorCompleted(
                firstMoment.add(1, "s").toDate(),
                false,
            ),
            HistoryEventFactory.GetOrchestratorStarted(
                firstMoment.add(1, "s").add(retryInterval, "ms").toDate(),
                false,
            ),
            HistoryEventFactory.GetTimerFired(
                firstMoment.add(1, "s").add(retryInterval, "ms").toDate(),
                false,
                firstMoment.add(1, "s").add(retryInterval, "ms").toDate(),
                1,
            ),
        ];
    }

    public static GetSayHelloWithSubOrchestratorReplayOne(firstTimestamp: Date, subInstanceId: string, input?: any) {
        const firstMoment = moment(firstTimestamp);

        return [
            HistoryEventFactory.GetOrchestratorStarted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetExecutionStarted(
                firstTimestamp,
                true,
                "SayHelloWithSubOrchestrator",
                input,
            ),
            HistoryEventFactory.GetSubOrchestrationInstanceCreated(
                0,
                firstTimestamp,
                false,
                "SayHelloWithActivity",
                input,
                subInstanceId,
            ),
            HistoryEventFactory.GetOrchestratorCompleted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetOrchestratorStarted(
                firstMoment.add(1, "s").toDate(),
                false,
            ),
            HistoryEventFactory.GetSubOrchestrationInstanceCompleted(
                firstMoment.add(1, "s").toDate(),
                false,
                JSON.stringify(`Hello, ${input}!`),
                0,
            ),
        ];
    }

    public static GetThrowsExceptionFromActivityReplayOne(firstTimestamp: Date) {
        return [
            HistoryEventFactory.GetOrchestratorStarted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetExecutionStarted(
                firstTimestamp,
                true,
                "DoesntHandleExceptionFromActivity",
                undefined,
            ),
            HistoryEventFactory.GetTaskScheduled(
                0,
                firstTimestamp,
                false,
                "ThrowsErrorActivity",
                undefined,
            ),
            HistoryEventFactory.GetOrchestratorCompleted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetOrchestratorStarted(
                moment(firstTimestamp).add(1, "s").toDate(),
                false,
            ),
            HistoryEventFactory.GetTaskFailed(
                moment(firstTimestamp).add(1, "s").toDate(),
                false,
                0,
                "Big stack trace here",
                "Activity function 'ThrowsErrorActivity' failed: Result: Failure",
            ),
        ];
    }

    public static GetWaitForExternalEventEventReceived(firstTimestamp: Date, eventName: string, input?: any) {
        const firstMoment = moment(firstTimestamp);

        return [
            HistoryEventFactory.GetOrchestratorStarted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetExecutionStarted(
                firstTimestamp,
                true,
                "WaitForExternalEvent",
                input,
            ),
            HistoryEventFactory.GetOrchestratorCompleted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetOrchestratorStarted(
                firstMoment.add(1, "s").toDate(),
                false,
            ),
            HistoryEventFactory.GetEventRaised(
                firstMoment.add(1, "s").toDate(),
                false,
                JSON.stringify(input),
                eventName,
            ),
        ];
    }

    public static GetWaitOnTimerFired(firstTimestamp: Date, fireAt: Date) {
        return [
            HistoryEventFactory.GetOrchestratorStarted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetExecutionStarted(
                firstTimestamp,
                true,
                "WaitOnTimer",
                fireAt,
            ),
            HistoryEventFactory.GetTimerCreated(
                0,
                firstTimestamp,
                false,
                fireAt,
            ),
            HistoryEventFactory.GetOrchestratorCompleted(
                firstTimestamp,
                false,
            ),
            HistoryEventFactory.GetOrchestratorStarted(
                fireAt,
                false,
            ),
            HistoryEventFactory.GetTimerFired(
                fireAt,
                false,
                fireAt,
                0,
            ),
        ];
    }
}
