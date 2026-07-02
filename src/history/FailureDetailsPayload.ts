/**
 * @hidden
 * Wire-format payload matching the JSON shape the Durable Task host extension
 * serializes for `DurableTask.Core.FailureDetails` (PascalCase via
 * `[DataMember]`). Includes the `Properties` map added by
 * https://github.com/Azure/azure-functions-durable-extension/pull/3215.
 */
export interface FailureDetailsPayload {
    ErrorType?: string;
    ErrorMessage?: string;
    StackTrace?: string;
    IsNonRetriable?: boolean;
    Properties?: Record<string, unknown> | null;
    InnerFailure?: FailureDetailsPayload | null;
}
