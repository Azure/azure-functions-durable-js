import { CreateTimerAction, IAction } from "../classes";
import { Task} from "./task";
import { TaskBase} from "./taskinterfaces";
import { TaskSet } from "./taskset";
import { TimerTask } from "./timertask";

export class TaskFactory {
    public static UncompletedTask(action: IAction): Task {
        return new Task(false, false, action);
    }

    public static SuccessfulTask(action: IAction, result: unknown, timestamp: Date, id: number, completedHistoryEventIndex: number): Task {
        return new Task(
            true,
            false,
            action,
            result,
            timestamp,
            id,
            undefined,
            completedHistoryEventIndex,
        );
    }

    public static FailedTask(action: IAction, reason: string | undefined, timestamp: Date, id: number, completedHistoryEventIndex: number, exception: Error): Task {
        return new Task(
            true,
            true,
            action,
            reason,
            timestamp,
            id,
            exception,
            completedHistoryEventIndex,
        );
    }

    public static CompletedTimerTask(action: CreateTimerAction, timestamp: Date, id: number, completedHistoryEventIndex: number): TimerTask {
        return new TimerTask(true, action, timestamp, id, completedHistoryEventIndex);
    }

    public static UncompletedTimerTask(action: CreateTimerAction): TimerTask {
        return new TimerTask(false, action);
    }

    public static SuccessfulTaskSet(tasks: TaskBase[], completionIndex: number, result: unknown): TaskSet {
        return new TaskSet(
            true,
            false,
            tasks,
            completionIndex,
            result,
            undefined,
        );
    }

    public static FailedTaskSet(tasks: TaskBase[], completionIndex: number, exception: Error): TaskSet {
        return new TaskSet(
            true,
            true,
            tasks,
            completionIndex,
            undefined,
            exception,
        );
    }

    public static UncompletedTaskSet(tasks: TaskBase[]): TaskSet {
        return new TaskSet(
            false,
            false,
            tasks,
            undefined,
            undefined,
            undefined,
        );
    }
}
