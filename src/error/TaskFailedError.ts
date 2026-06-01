import * as types from "durable-functions";
import { FailureDetailsDto } from "../history/FailureDetailsDto";

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

    constructor(failureDetails: types.FailureDetails) {
        super(`${failureDetails.errorType}: ${failureDetails.errorMessage}`);
        this.name = "TaskFailedError";
        this.failureDetails = failureDetails;
        if (failureDetails.stackTrace) {
            this.stack = failureDetails.stackTrace;
        }
    }

    public static fromWireDto(dto: FailureDetailsDto): TaskFailedError {
        return new TaskFailedError(toFailureDetails(dto));
    }
}

function toFailureDetails(dto: FailureDetailsDto): types.FailureDetails {
    return {
        errorType: dto.ErrorType ?? "Error",
        errorMessage: dto.ErrorMessage ?? "",
        stackTrace: dto.StackTrace ?? undefined,
        isNonRetriable: dto.IsNonRetriable ?? false,
        properties: dto.Properties ?? undefined,
        innerFailure: dto.InnerFailure ? toFailureDetails(dto.InnerFailure) : undefined,
    };
}
