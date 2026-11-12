import { InvocationContext } from "@azure/functions";
import { DurableActivityRetryContext } from "durable-functions";
import { DurableError } from "../error/DurableError";

function isPositiveInt32(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 2147483647;
}

function parseActivityRetryMetadata(value: unknown): DurableActivityRetryContext {
    const errorPrefix = "Invalid durableActivityRetryMetadata contract: ";
    const isWireString = typeof value === "string";
    let metadata: unknown = value;
    if (typeof value === "string") {
        try {
            metadata = JSON.parse(value);
        } catch {
            throw new DurableError(errorPrefix + "expected valid JSON.");
        }
    }

    if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) {
        throw new DurableError(errorPrefix + "expected a JSON object.");
    }

    // Functions converts RPC strings to JSON and recursively camel-cases trigger metadata.
    const fields = metadata as Record<string, unknown>;
    const attemptNumber = fields[isWireString ? "AttemptNumber" : "attemptNumber"];
    const maxAttempts = fields[isWireString ? "MaxAttempts" : "maxAttempts"];
    const retryGroupId = fields[isWireString ? "RetryGroupId" : "retryGroupId"];
    if (!isPositiveInt32(attemptNumber) || !isPositiveInt32(maxAttempts)) {
        throw new DurableError(
            errorPrefix + "AttemptNumber and MaxAttempts must be positive int32 integers."
        );
    }
    if (attemptNumber > maxAttempts) {
        throw new DurableError(errorPrefix + "AttemptNumber must not exceed MaxAttempts.");
    }
    if (typeof retryGroupId !== "string" || retryGroupId.trim().length === 0) {
        throw new DurableError(errorPrefix + "RetryGroupId must be a nonempty string.");
    }

    return {
        attemptNumber,
        maxAttempts,
        retryGroupId,
    };
}

/** @hidden */
export function setActivityRetryContext(context: InvocationContext): void {
    const metadata = context.triggerMetadata;
    if (
        metadata &&
        Object.prototype.hasOwnProperty.call(metadata, "durableActivityRetryMetadata")
    ) {
        const activityRetryContext = parseActivityRetryMetadata(
            metadata.durableActivityRetryMetadata
        );
        Object.assign(context, { activityRetryContext });
    }
}
