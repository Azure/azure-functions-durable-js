import { Task } from "./classes";

/** @hidden */
export class TaskSet {
    constructor(
        public isCompleted: boolean,
        public isFaulted: boolean,
        public tasks: Task[],
        public result?: unknown,
        public exception?: unknown,
    ) { }
}
