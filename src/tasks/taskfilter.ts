import { Task } from "./task";
import {
    CompletedTask,
    FailedTask,
    SuccessfulTask,
    TaskBase,
    UncompletedTask,
} from "./taskinterfaces";
import { TaskSet } from "./taskset";

/** @hidden */
export class TaskFilter {
    public static CompareFinishedTime(taskA: CompletedTask, taskB: CompletedTask): -1 | 0 | 1 {
        if (taskA.completionIndex > taskB.completionIndex) {
            return 1;
        }
        if (taskA.completionIndex < taskB.completionIndex) {
            return -1;
        }
        return 0;
    }

    public static isYieldable(task: any): task is TaskBase {
        const taskBase = task as TaskBase;
        return (
            taskBase &&
            taskBase.isCompleted !== undefined &&
            taskBase.isFaulted !== undefined &&
            taskBase.yieldNewActions !== undefined
        );
    }

    public static isSingleTask(task: TaskBase): task is Task {
        return task instanceof Task;
    }

    public static isTaskSet(task: TaskBase): task is TaskSet {
        return task instanceof TaskSet;
    }

    public static isCompletedTask(task: TaskBase): task is CompletedTask {
        return task.isCompleted;
    }

    public static isUncompletedTask(task: TaskBase): task is UncompletedTask {
        return task.isCompleted === false;
    }

    public static isSuccessfulTask(task: TaskBase): task is SuccessfulTask {
        return task.isCompleted === true && task.isFaulted === false;
    }

    public static isFailedTask(task: TaskBase): task is FailedTask {
        return task.isCompleted === true && task.isFaulted === true;
    }
}
