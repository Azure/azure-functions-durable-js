import { Task, TaskSet } from "./classes";

export interface ITaskMethods {
    all: ITaskAny;
    any: ITaskAll;
}

type ITaskAny = (tasks: Task[]) => TaskSet;
type ITaskAll = (tasks: Task[]) => TaskSet;
