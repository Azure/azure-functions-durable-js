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
 * Sentinel label appended to an error message to carry custom exception
 * properties back to the Durable Task host extension. Mirrors the existing
 * `$OutOfProcData$` convention so the extension can locate and strip it.
 *
 * NOTE: Single source of truth for the wire format. If the host extension
 * expects a different sentinel or encoding, change it here only.
 */
export const exceptionPropertiesLabel = "\n\n$FailureProperties$:";

/**
 * @hidden
 * Returns `message` with a serialized exception-properties suffix appended
 * when the registered provider yields properties for `error`. Otherwise
 * returns `message` unchanged.
 */
export function appendExceptionPropertiesSuffix(message: string, error: unknown): string {
    const props = extractExceptionProperties(error);
    if (!props) {
        return message;
    }
    return `${message}${exceptionPropertiesLabel}${JSON.stringify(props)}`;
}
