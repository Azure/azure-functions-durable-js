import { IAction } from "./classes";

export class Task {
    constructor(
        public isCompleted: boolean,
        public action: IAction,
        public result?: any,
        public timestamp?: Date,
        public id?: number,
    ) { }
}
