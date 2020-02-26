import { IAction } from "../classes";

// Base interfaces
export interface TaskBase {
    readonly isCompleted: boolean;
    readonly isFaulted: boolean;
    yieldNewActions(): IAction[];
}

export interface UncompletedTask extends TaskBase {
    readonly isCompleted: false;
    readonly isFaulted: false;
}

export interface CompletedTask extends TaskBase {
    readonly completionIndex: number;
    readonly isCompleted: true;
    readonly result: unknown | undefined;
}

export interface SuccessfulTask extends CompletedTask {
    readonly isFaulted: false;
    readonly result: unknown;
    readonly exception: undefined;
}

export interface FailedTask extends CompletedTask {
    readonly isFaulted: true;
    readonly exception: Error;
    readonly result: undefined;
}
