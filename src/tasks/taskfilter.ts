import { SingleTask } from "./task";
import { CompletedTask, FailedTask, SuccessfulTask, Task, UncompletedTask } from "./taskinterfaces";
import { TaskSet } from "./taskset";

/** @hidden */
export class TaskFilter {
    public static CompareFinishedTime(taskA: CompletedTask, taskB: CompletedTask) {
        if (taskA.completionIndex > taskB.completionIndex) { return 1; }
        if (taskA.completionIndex < taskB.completionIndex) { return -1; }
        return 0;
    }

    public static isYieldable(task: any): task is Task {
        const ATask = task as Task;
        return ATask
            && ATask.isCompleted !== undefined
            && ATask.isFaulted !== undefined
            && ATask.yieldNewActions !== undefined;
    }

    public static isSingleTask(task: Task): task is SingleTask {
        return (task instanceof SingleTask);
    }

    public static isTaskSet(task: Task): task is TaskSet {
        return (task instanceof TaskSet);
    }

    public static isCompletedTask(task: Task): task is CompletedTask {
        return task.isCompleted;
    }

    public static isUncompletedTask(task: Task): task is UncompletedTask  {
        return task.isCompleted === false;
    }

    public static isSuccessfulTask(task: Task): task is SuccessfulTask {
        return task.isCompleted === true && task.isFaulted === false;
    }

    public static isFailedTask(task: Task): task is FailedTask {
        return task.isCompleted === true && task.isFaulted === true;
    }
}
