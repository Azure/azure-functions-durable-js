import { HistoryEvent } from "./classes";

export interface IDurableOrchestrationBindingInfo {
    history: HistoryEvent[];
    input: unknown;
    instanceId: string;
    isReplaying: boolean;
    parentInstanceId: string;
}
