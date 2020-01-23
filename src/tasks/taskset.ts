import { Yieldable } from "./yieldable";

/** @hidden */
export class TaskSet {
    constructor(
        public readonly isCompleted: boolean,
        public readonly isFaulted: boolean,
        public readonly tasks: Yieldable[],
        public result?: unknown,
        public exception?: Error,
    ) { }
}
