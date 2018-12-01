import { Task, TaskSet } from "./classes";

/** @hidden */
export interface ITaskMethods {
    all: ITaskAny;
    any: ITaskAll;
}

/** @hidden */
type ITaskAny = (tasks: Task[]) => TaskSet;

/** @hidden */
type ITaskAll = (tasks: Task[]) => TaskSet;
