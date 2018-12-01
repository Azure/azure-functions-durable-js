import { HistoryEvent } from "./classes";

/** @hidden */
export interface IDurableOrchestrationBindingInfo {
    history: HistoryEvent[];
    input: unknown;
    instanceId: string;
    isReplaying: boolean;
    parentInstanceId: string;
}
