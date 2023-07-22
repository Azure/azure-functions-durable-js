import { IAction } from "../classes";

/**
 * @hidden
 * The states a task can be in
 */
export enum TaskState {
    Running,
    Failed,
    Completed,
}

/**
 * @hidden
 * A taskID, either a `string` for external events,
 * or either `false` or a `number` for un-awaited
 * and awaited tasks respectively.
 */
export type TaskID = number | string | false;

/**
 * @hidden
 * A backing action, either a proper action or "noOp" for an internal-only task
 */
export type BackingAction = IAction | "noOp";

export * from "./TaskBase";
export * from "./DFTask";
export * from "./CompoundTask";
export * from "./AtomicTask";
export * from "./NoOpTask";
export * from "./DFTimerTask";
export * from "./CallHttpWithPollingTask";
export * from "./LongTimerTask";
export * from "./RetryableTask";
export * from "./WhenAllTask";
export * from "./WhenAnyTask";
