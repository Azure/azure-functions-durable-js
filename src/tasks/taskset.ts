import { IAction } from "../classes"; 
import { TaskBase } from "./taskinterfaces";

/** @hidden */
export class TaskSet implements TaskBase {

    constructor(
        public readonly isCompleted: boolean,
        public readonly isFaulted: boolean,
        private readonly tasks: TaskBase[],
        private readonly completionIndex?: number,
        public result?: unknown,
        public exception?: Error,
    ) { }

    yield(): IAction[] {
        // Get all of the actions in subtasks and flatten into one array.
        return this.tasks.map((task) => task.yield())
            .reduce((acc, arr) => acc.concat(arr));
    }
}
