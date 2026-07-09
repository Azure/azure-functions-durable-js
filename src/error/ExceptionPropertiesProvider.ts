import * as types from "durable-functions";

/** @hidden */
let registeredProvider: types.ExceptionPropertiesProvider | undefined;

/** @hidden */
export function setRegisteredExceptionPropertiesProvider(
    provider: types.ExceptionPropertiesProvider | undefined
): void {
    registeredProvider = provider;
}

/**
 * @hidden
 * Safely invokes the registered provider. Returns `undefined` when no provider
 * is registered, the provider returns nothing, or the provider itself throws.
 */
export function extractExceptionProperties(error: unknown): Record<string, unknown> | undefined {
    if (!registeredProvider) {
        return undefined;
    }
    try {
        const result = registeredProvider.getExceptionProperties(error);
        if (!result) {
            return undefined;
        }
        return { ...result };
    } catch {
        return undefined;
    }
}

/**
 * @hidden
 * Builds the single-line JSON payload that mirrors the protobuf
 * `TaskFailureDetails` shape consumed by the Durable Task host extension's
 * `OutOfProcMiddleware.TryExtractSerializedFailureDetailsFromException`.
 *
 * Returns `undefined` when the registered provider yields no properties for
 * the given error — callers should then leave the original error untouched so
 * existing JS wire-format behaviour is preserved for users who haven't opted in.
 *
 * Also returns `undefined` if serialization fails (for example, when the
 * provider's properties contain circular references or non-serializable
 * values such as `BigInt`). In that case the caller re-throws the original
 * error untouched rather than surfacing a serialization error in place of the
 * user's exception.
 */
export function buildTaskFailureDetailsJson(error: unknown): string | undefined {
    const properties = extractExceptionProperties(error);
    if (!properties) {
        return undefined;
    }

    const errorObj = error instanceof Error ? error : undefined;
    const errorType = errorObj?.name ?? errorObj?.constructor?.name ?? "Error";
    let errorMessage: string;
    if (errorObj?.message !== undefined) {
        errorMessage = errorObj.message;
    } else if (typeof error === "string") {
        errorMessage = error;
    } else {
        try {
            errorMessage = JSON.stringify(error) ?? String(error);
        } catch {
            errorMessage = String(error);
        }
    }

    const payload: Record<string, unknown> = {
        errorType,
        errorMessage,
        isNonRetriable: false,
        properties,
    };
    if (errorObj?.stack) {
        payload.stackTrace = errorObj.stack;
    }

    try {
        return JSON.stringify(payload);
    } catch {
        return undefined;
    }
}
