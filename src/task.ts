import { IAction } from "./classes";

/**
 * Represents some pending action. Similar to a native JavaScript promise in
 * that it acts as a placeholder for outstanding asynchronous work, but has
 * a synchronous implementation and is specific to Durable Functions.
 *
 * Tasks are only returned to an orchestration function when a
 * [[DurableOrchestrationContext]] operation is not called with `yield`. They
 * are useful for parallelization and timeout operations in conjunction with
 * Task.all and Task.any.
 *
 * @example Wait for all parallel operations to complete
 * ```javascript
 * const operations = context.df.callActivity("GetOperations");
 *
 * const tasks = [];
 * for (const operation of operations) {
 *     tasks.push(context.df.callActivity("DoOperation", operation));
 * }
 *
 * const results = yield context.df.Task.all(tasks);
 * ```
 *
 * @example Return the result of the first of two operations to complete
 * ```javascript
 * const taskA = context.df.callActivity("DoWorkA");
 * const taskB = context.df.callActivity("DoWorkB");
 *
 * const firstDone = yield context.df.Task.any([taskA, taskB]);
 *
 * return firstDone.result;
 * ```
 */
// export class Task {
//     public wasYielded = false;
    

//     /** @hidden */
//     constructor(
//         /**
//          * Whether the task has completed. Note that completion is not
//          * equivalent to success.
//          */
//         public readonly isCompleted: boolean,
//         /**
//          * Whether the task faulted in some way due to error.
//          */
//         public readonly isFaulted: boolean,
//         /**
//          * The scheduled action represented by the task. _Internal use only._
//          */
//         public readonly action: IAction,
//         /**
//          * The result of the task, if completed. Otherwise `undefined`.
//          */
//         public readonly result?: unknown,
//         /**
//          * The timestamp of the task.
//          */
//         public readonly timestamp?: Date,
//         /**
//          * The ID number of the task. _Internal use only._
//          */
//         public readonly id?: number,
//         /**
//          * The error thrown when attempting to perform the task's action. If
//          * the Task has not yet completed or has completed successfully,
//          * `undefined`.
//          */
//         public readonly exception?: unknown,
//         /**
//          * The index of the history event that indicated the task is completed.
//         */
//         public completedHistoryEventIndex?: number | undefined 
//     ) { }
// }

export class TaskFactory {
    public static UncompletedTask(action : IAction) : UncompletedTask {
        return {
            isCompleted: false,
            isFaulted: false,
            action: action,
            isYielded: false
        };
    }

    public static SuccessfulTask(action : IAction, result: unknown, timestamp: Date, id: number, completedHistoryEventIndex: number) : SuccessfulTask {
        return {
            isCompleted: true,
            isFaulted: false,
            action: action,
            isYielded: false,
            result: result,
            timestamp: timestamp,
            id: id,
            completedHistoryEventIndex: completedHistoryEventIndex
        };
    }

    public static FailedTask(action: IAction, result: unknown, timestamp: Date, id: number, completedHistoryEventIndex: number, exception: unknown) : FailedTask {
        return {
            isCompleted: true,
            isFaulted: true,
            action: action,
            isYielded: false,
            result: result,
            timestamp: timestamp,
            id: id,
            completedHistoryEventIndex: completedHistoryEventIndex,
            exception: exception
        };
    }
}

export type Task = UncompletedTask | SuccessfulTask | FailedTask; 

export interface UncompletedTask {
    readonly isCompleted: false;
    readonly isFaulted: boolean;
    readonly action: IAction;
    isYielded: boolean;
}

export interface SuccessfulTask {
    readonly isCompleted: true;
    readonly isFaulted: false;
    readonly action: IAction;
    readonly result: unknown;
    readonly timestamp: Date;
    readonly id: number;
    completedHistoryEventIndex: number;
    isYielded: boolean;
}

export interface FailedTask {
    readonly isCompleted: true;
    readonly isFaulted: true;
    readonly action: IAction;
    readonly result: unknown;
    readonly timestamp: Date;
    readonly id: number;
    readonly exception: unknown;
    completedHistoryEventIndex: number;
    isYielded: boolean;
}