import { OrchestratorState } from "./classes";

const outOfProcDataLabel = "\n\n$OutOfProcData$:";

/**
 * A wrapper for all errors thrown within an orchestrator function. This exception will embed
 * the orchestrator state in a way that the C# extension knows how to read so that it can replay the
 * actions scheduled before throwing an exception. This prevents non-determinism errors in Durable Task.
 *
 * Note that making any changes to the following schema to OrchestrationFailureError.message could be considered a breaking change:
 *
 * "<error message as a string>\n\n$OutOfProcData$<json representation of state>"
 */
export class OrchestrationFailureError extends Error {
    constructor(error: any, state: OrchestratorState) {
        let errorMessage: string;
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof(error) === "string") {
            errorMessage = error;
        } else {
            errorMessage = JSON.stringify(error);
        }

        const message = `${errorMessage}${outOfProcDataLabel}${JSON.stringify(state)}`;
        super(message);
        this.stack = error.stack;
    }
}
