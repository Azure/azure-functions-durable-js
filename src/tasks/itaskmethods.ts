import { Task } from "./task";
import { TaskSet } from "./taskset";

/**
 * Methods to handle collections of pending actions represented by [[Task]]
 * instances. For use in parallelization operations.
 */
export interface ITaskMethods {
    /**
     * Similar to Promise.all. When called with `yield` or `return`, returns an
     * array containing the results of all [[Task]]s passed to it. It returns
     * when all of the [[Task]] instances have completed.
     */
    all: (tasks: Task[]) => TaskSet;

    /**
     * Similar to Promise.race. When called with `yield` or `return`, returns
     * the first [[Task]] instance to complete.
     */
    any: (tasks: Task[]) => TaskSet;
}
