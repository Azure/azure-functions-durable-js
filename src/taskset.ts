import { IAction } from "./classes";

/** @hidden */
export class TaskSet {
    constructor(
        public isCompleted: boolean,
        public isFaulted: boolean,
        public actions: IAction[],
        public result?: unknown,
        public exception?: unknown,
    ) { }
}
