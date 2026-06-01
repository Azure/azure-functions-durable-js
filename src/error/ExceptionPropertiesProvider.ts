import * as types from "durable-functions";

/** @hidden */
let registeredProvider: types.ExceptionPropertiesProvider | undefined;

/** @hidden */
export function setRegisteredExceptionPropertiesProvider(
    provider: types.ExceptionPropertiesProvider | undefined
): void {
    registeredProvider = provider;
}

/** @hidden */
export function getRegisteredExceptionPropertiesProvider():
    | types.ExceptionPropertiesProvider
    | undefined {
    return registeredProvider;
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
 */
export function buildTaskFailureDetailsJson(error: unknown): string | undefined {
    const properties = extractExceptionProperties(error);
    if (!properties) {
        return undefined;
    }

    const errorObj = error instanceof Error ? error : undefined;
    const errorType =
        errorObj?.constructor?.name ?? (typeof error === "string" ? "Error" : "Error");
    const errorMessage =
        errorObj?.message ?? (typeof error === "string" ? error : JSON.stringify(error));

    const payload: Record<string, unknown> = {
        errorType,
        errorMessage,
        isNonRetriable: false,
        properties,
    };
    if (errorObj?.stack) {
        payload.stackTrace = errorObj.stack;
    }
    return JSON.stringify(payload);
}
