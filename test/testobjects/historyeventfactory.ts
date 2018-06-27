import * as moment from "moment";
import { HistoryEvent, HistoryEventType } from "../../src/classes";

export class HistoryEventFactory {
    public static GetEventRaised(
        timeStamp: Date,
        isPlayed: boolean,
        input: any,
        name: string) {
        return new HistoryEvent(
            -1,
            HistoryEventType.EventRaised,
            undefined,
            isPlayed,
            input,
            name,
            undefined,
            undefined,
            undefined,
            timeStamp,
        );
    }

    public static GetExecutionStarted(
        timeStamp: Date,
        isPlayed: boolean,
        name: string,
        input: any,
        version: string = "") {
        return new HistoryEvent(
            -1,
            HistoryEventType.ExecutionStarted,
            undefined,
            isPlayed,
            input,
            name,
            undefined,
            undefined,
            undefined,
            timeStamp,
        );
    }

    public static GetOrchestratorCompleted(
        timeStamp: Date,
        isPlayed: boolean) {
        return new HistoryEvent(
            -1,
            HistoryEventType.OrchestratorCompleted,
            undefined,
            isPlayed,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            timeStamp,
        );
    }

    public static GetOrchestratorStarted(
        timeStamp: Date,
        isPlayed: boolean) {
        return new HistoryEvent(
            -1,
            HistoryEventType.OrchestratorStarted,
            undefined,
            isPlayed,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            timeStamp,
        );
    }

    public static GetTaskCompleted(
        timeStamp: Date,
        isPlayed: boolean,
        taskScheduledId: number,
        result: any,
    ) {
        return new HistoryEvent(
            -1,
            HistoryEventType.TaskCompleted,
            undefined,
            isPlayed,
            undefined,
            undefined,
            result,
            taskScheduledId,
            undefined,
            timeStamp,
        );
    }

    public static GetTaskScheduled(
        eventId: number,
        timeStamp: Date,
        isPlayed: boolean,
        name: string,
        input: string,
        version: string = "",
    ) {
        return new HistoryEvent(
            eventId,
            HistoryEventType.TaskScheduled,
            undefined,
            isPlayed,
            null,
            name,
            undefined,
            undefined,
            undefined,
            timeStamp,
        );
    }

    public static GetTimerCreated(
        eventId: number,
        timeStamp: Date,
        isPlayed: boolean,
        fireAt: Date,
    ) {
        return new HistoryEvent(
            eventId,
            HistoryEventType.TimerCreated,
            fireAt,
            isPlayed,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            timeStamp,
        );
    }

    public static GetTimerFired(
        timeStamp: Date,
        isPlayed: boolean,
        fireAt: Date,
        timerId: number,
    ) {
        return new HistoryEvent(
            -1,
            HistoryEventType.TimerFired,
            fireAt,
            isPlayed,
            undefined,
            undefined,
            undefined,
            undefined,
            timerId,
            timeStamp,
        );
    }
}
