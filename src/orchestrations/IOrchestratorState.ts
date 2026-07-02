import { IAction } from "../actions/IAction";
import { FailureDetailsPayload } from "../history/FailureDetailsPayload";
import { ReplaySchema } from "./ReplaySchema";

/** @hidden */
export interface IOrchestratorState {
    isDone: boolean;
    actions: IAction[][];
    output: unknown;
    error?: string;
    customStatus?: unknown;
    schemaVersion: ReplaySchema;
    /**
     * Structured failure details for an orchestration that failed because an
     * uncaught sub-orchestration or activity failure propagated out of the
     * orchestrator. Carries the full `InnerFailure` chain (including any custom
     * `Properties`) so the host can relay it to a calling parent orchestration.
     * Only present on failure; absent (and omitted from the wire payload)
     * otherwise, so existing host behavior is unaffected.
     */
    failureDetails?: FailureDetailsPayload;
}
