import { IAction } from "./classes";

export class TaskSet {
    constructor(
        public isCompleted: boolean,
        public actions: IAction[],
        public result?: unknown,
    ) { }
}
