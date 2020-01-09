import { IAction } from "../classes";

 // Base interfaces
interface TaskBase {
    readonly isCompleted: boolean;
    readonly isFaulted: boolean;
 }

export interface SingleTask extends TaskBase {
    readonly action: IAction;
    wasYielded: boolean;
}

export interface UncompletedSingleTask extends TaskBase {
    readonly isCompleted: false;
    readonly isFaulted: false;
}

export interface CompletedSingleTask extends SingleTask {
    completedHistoryEventIndex: number;
    readonly timestamp: Date;
    readonly id: number;
    readonly isCompleted: true;
    readonly result: unknown;
}

export interface SuccessfulSingleTask extends CompletedSingleTask {
    readonly isFaulted: false;
    readonly exception: undefined;
}

export interface FailedSingleTask extends CompletedSingleTask {
    readonly isFaulted: true;
    readonly exception: unknown;
    readonly result: undefined;
}

interface TaskCollection extends TaskBase {
    readonly tasks: SingleTask[];
}

export interface CompletedTaskSet extends TaskCollection {
    readonly isCompleted: true;
    readonly result: unknown;
}

export interface UncompletedTaskSet extends TaskCollection {
    readonly isCompleted: false;
    readonly isFaulted: false;
}

export interface FailedTaskSet extends CompletedTaskSet {
    readonly isFaulted: true;
    readonly exception: unknown;
    readonly result: undefined;
}

export interface SuccessfulTaskSet extends CompletedTaskSet {
    readonly isFaulted: false;
    readonly exception: undefined;
}

export type CompletedTask = CompletedSingleTask | CompletedTaskSet;

export type UncompletedTask = UncompletedTaskSet & UncompletedSingleTask;

export type SuccessfulTask =  SuccessfulTaskSet & SuccessfulSingleTask;

export type FailedTask = FailedTaskSet & FailedSingleTask;
