import { Task } from "./task";
import { CompletedTask, FailedTask, SuccessfulSingleTask, SuccessfulTask, UncompletedTask } from "./taskinterfaces";
import { TaskSet } from "./taskset";

export class TaskFilter {
    public static isTask(value: unknown): value is (Task | TaskSet) {
        if (!value) {
            return false;
        }
        const task = value as (Task | TaskSet);
        return task.isCompleted !== undefined && task.isFaulted !== undefined;
    }

    public static isSingleTask(task: Task | TaskSet): task is Task {
        return (task instanceof Task);
    }

    public static isTaskSet(task: Task | TaskSet): task is TaskSet {
        return (task instanceof TaskSet);
    }

    public static isCompletedTask(task: Task | TaskSet): task is CompletedTask {
        return task.isCompleted;
    }

    public static isUncompletedTask(task: Task | TaskSet): task is UncompletedTask  {
        return task.isCompleted === false;
    }

    public static isSuccessfulTask(task: Task | TaskSet): task is SuccessfulTask  {
        const successfulTask = task as SuccessfulTask;
        return successfulTask.isCompleted === true && successfulTask.isFaulted === false && successfulTask.result !== undefined;
    }

    public static isSuccessfulSingleTask(task: Task): task is SuccessfulSingleTask  {
        return TaskFilter.isSingleTask(task) && task.isCompleted === true && task.isFaulted === false && task.result !== undefined;
    }

    public static isFailedTask(task: Task | TaskSet): task is FailedTask {
        return task.isCompleted === true && task.isFaulted === true;
    }
}
