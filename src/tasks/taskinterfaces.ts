import { IAction } from "../classes";

// Base interfaces
/** @hidden */
export interface TaskBase {
    readonly isCompleted: boolean;
    readonly isFaulted: boolean;
    yieldNewActions(): IAction[];
}

/** @hidden */
export interface UncompletedTask extends TaskBase {
    readonly isCompleted: false;
    readonly isFaulted: false;
}

/** @hidden */
export interface CompletedTask extends TaskBase {
    readonly completionIndex: number;
    readonly isCompleted: true;
    readonly result: unknown | undefined;
}

/** @hidden */
export interface SuccessfulTask extends CompletedTask {
    readonly isFaulted: false;
    readonly result: unknown;
    readonly exception: undefined;
}

/** @hidden */
export interface FailedTask extends CompletedTask {
    readonly isFaulted: true;
    readonly exception: Error;
    readonly result: undefined;
}
