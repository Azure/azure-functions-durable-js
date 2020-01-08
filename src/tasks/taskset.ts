import { SingleTask } from "./taskinterfaces";

/** @hidden */
export class TaskSet {
    constructor(
        public readonly isCompleted: boolean,
        public readonly isFaulted: boolean,
        public readonly tasks: SingleTask[],
        public result?: unknown,
        public exception?: unknown,
    ) { }
}
