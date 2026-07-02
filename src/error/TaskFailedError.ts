import * as types from "durable-functions";
import { FailureDetailsPayload } from "../history/FailureDetailsPayload";

/**
 * Error subclass thrown into orchestrator generators when a scheduled activity
 * or sub-orchestration fails and the host has provided structured
 * `FailureDetails` (including any custom `Properties` attached via an
 * {@link types.ExceptionPropertiesProvider} on the failing worker).
 *
 * Falls back to a plain `Error` for legacy host versions that do not include
 * `FailureDetails` on the history event.
 */
export class TaskFailedError extends Error implements types.TaskFailedError {
    public readonly failureDetails: types.FailureDetails;
    public readonly taskName?: string;
    public readonly taskId?: number;

    constructor(failureDetails: types.FailureDetails, taskName?: string, taskId?: number) {
        super(`${failureDetails.errorType}: ${failureDetails.errorMessage}`);
        this.name = "TaskFailedError";
        this.failureDetails = failureDetails;
        this.taskName = taskName;
        this.taskId = taskId;
        if (failureDetails.stackTrace) {
            this.stack = failureDetails.stackTrace;
        }
    }

    public static fromWireDto(
        dto: FailureDetailsPayload,
        taskName?: string,
        taskId?: number
    ): TaskFailedError {
        return new TaskFailedError(toFailureDetails(dto), taskName, taskId);
    }
}

/**
 * @hidden
 * Returns true if `details`, or any failure in its `innerFailure` chain, has the
 * given `errorType`. Backs {@link types.FailureDetails.isCausedBy}.
 */
function failureIsCausedBy(details: types.FailureDetails, errorType: string): boolean {
    let current: types.FailureDetails | undefined = details;
    while (current) {
        if (current.errorType === errorType) {
            return true;
        }
        current = current.innerFailure;
    }
    return false;
}

function toFailureDetails(dto: FailureDetailsPayload): types.FailureDetails {
    const details: types.FailureDetails = {
        errorType: dto.ErrorType ?? "Error",
        errorMessage: dto.ErrorMessage ?? "",
        stackTrace: dto.StackTrace ?? undefined,
        isNonRetriable: dto.IsNonRetriable ?? false,
        properties: dto.Properties ?? undefined,
        innerFailure: dto.InnerFailure ? toFailureDetails(dto.InnerFailure) : undefined,
        isCausedBy(errorType: string): boolean {
            return failureIsCausedBy(details, errorType);
        },
    };
    return details;
}

/**
 * @hidden
 * Converts a {@link types.FailureDetails} (camelCase, as reconstructed on the
 * worker) back into the PascalCase {@link FailureDetailsPayload} wire shape the host
 * extension expects. Used when an uncaught {@link TaskFailedError} propagates out
 * of an orchestrator so the host can relay the structured failure (including the
 * full `InnerFailure` chain and custom `Properties`) to a calling parent
 * orchestration. Inverse of `toFailureDetails`.
 */
export function toFailureDetailsPayload(details: types.FailureDetails): FailureDetailsPayload {
    return {
        ErrorType: details.errorType,
        ErrorMessage: details.errorMessage,
        StackTrace: details.stackTrace,
        IsNonRetriable: details.isNonRetriable,
        Properties: details.properties ?? undefined,
        InnerFailure: details.innerFailure
            ? toFailureDetailsPayload(details.innerFailure)
            : undefined,
    };
}
