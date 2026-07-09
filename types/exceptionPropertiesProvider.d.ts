/**
 * Provides custom properties to attach to the `FailureDetails` of an error
 * thrown from an activity function. Register an implementation once at app
 * startup via {@link app.setExceptionPropertiesProvider}.
 *
 * @example
 * ```typescript
 * import * as df from "durable-functions";
 *
 * class MyError extends Error {
 *     constructor(message: string, public readonly code: number) {
 *         super(message);
 *     }
 * }
 *
 * df.app.setExceptionPropertiesProvider({
 *     getExceptionProperties(error) {
 *         if (error instanceof MyError) {
 *             return { code: error.code };
 *         }
 *         return undefined;
 *     },
 * });
 * ```
 */
export interface ExceptionPropertiesProvider {
    /**
     * Returns a plain object whose entries are merged into the
     * `FailureDetails.Properties` for the given thrown value. Return
     * `undefined` to opt out of adding properties for a particular error.
     *
     * Any error thrown by this method is swallowed by the SDK so that a
     * faulty provider cannot mask the original failure.
     *
     * Avoid secret-shaped values (e.g. `token=`, `code=`, or `user:pass@host`
     * URLs): the worker sanitizes error content before sending it, which can
     * redact such values and cause a fallback to the legacy failure format.
     *
     * @param error The thrown value. May be an `Error` instance, a thrown
     * primitive, or any other value.
     */
    getExceptionProperties(error: unknown): Record<string, unknown> | undefined;
}
