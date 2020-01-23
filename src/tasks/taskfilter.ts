import { Task } from "./task";
import { CompletedYieldable, FailedYieldable, SuccessfulSingleTask, SuccessfulYieldable, UncompletedYieldable } from "./taskinterfaces";
import { TaskSet } from "./taskset";
import { Yieldable } from "./yieldable";

export class TaskFilter {
    public static isYieldable(value: unknown): value is Yieldable {
        if (!value) {
            return false;
        }
        const task = value as (Yieldable);
        return task.isCompleted !== undefined && task.isFaulted !== undefined;
    }

    public static isSingleTask(task: Yieldable): task is Task {
        return (task instanceof Task);
    }

    public static isTaskSet(task: Yieldable): task is TaskSet {
        return (task instanceof TaskSet);
    }

    public static isCompletedTask(task: Yieldable): task is CompletedYieldable {
        return task.isCompleted;
    }

    public static isUncompletedTask(task: Yieldable): task is UncompletedYieldable  {
        return task.isCompleted === false;
    }

    public static isSuccessfulTask(task: Yieldable): task is SuccessfulYieldable  {
        const successfulTask = task as SuccessfulYieldable;
        return successfulTask.isCompleted === true && successfulTask.isFaulted === false && successfulTask.result !== undefined;
    }

    public static isSuccessfulSingleTask(task: Task): task is SuccessfulSingleTask  {
        return TaskFilter.isSingleTask(task) && task.isCompleted === true && task.isFaulted === false && task.completionIndex !== undefined;
    }

    public static isFailedTask(task: Yieldable): task is FailedYieldable {
        return task.isCompleted === true && task.isFaulted === true;
    }
}
