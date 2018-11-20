import { ITaskMethods, RetryOptions, Task, TimerTask } from "./classes";

export interface IDurableOrchestrationContext {
    instanceId: string;
    isReplaying: boolean;
    parentInstanceId: string;
    currentUtcDateTime: Date;
    callActivity: ICallActivity;
    callActivityWithRetry: ICallActivityWithRetry;
    callSubOrchestrator: ICallSubOrchestrator;
    callSubOrchestratorWithRetry: ICallSubOrchestratorWithRetry;
    continueAsNew: IContinueAsNew;
    createTimer: ICreateTimer;
    getInput: IGetInput;
    setCustomStatus: ISetCustomStatus;
    waitForExternalEvent: IWaitForExternalEvent;
    Task: ITaskMethods;
}

type ICallActivity = (name: string, input?: unknown) => Task;
type ICallActivityWithRetry = (name: string, retryOptions: RetryOptions, input?: unknown) => Task;
type ICallSubOrchestrator = (name: string, input?: unknown, instanceId?: string) => Task;
type ICallSubOrchestratorWithRetry =
    (name: string, retryOptions: RetryOptions, input?: unknown, instanceId?: string) => Task;
type IContinueAsNew = (input: unknown) => Task;
type ICreateTimer = (fireAt: Date) => TimerTask;
type IGetInput = () => unknown;
type ISetCustomStatus = (customStatusObject: unknown) => void;
type IWaitForExternalEvent = (name: string) => Task;
