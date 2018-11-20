import { IAction } from "./classes";

export class Task {
    constructor(
        public isCompleted: boolean,
        public isFaulted: boolean,
        public action: IAction,
        public result?: unknown,
        public timestamp?: Date,
        public id?: number,
        public exception?: unknown,
    ) { }
}
