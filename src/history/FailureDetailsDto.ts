/**
 * @hidden
 * Wire-format DTO matching the JSON shape the Durable Task host extension
 * serializes for `DurableTask.Core.FailureDetails` (PascalCase via
 * `[DataMember]`). Includes the `Properties` map added by
 * https://github.com/Azure/azure-functions-durable-extension/pull/3215.
 */
export interface FailureDetailsDto {
    ErrorType?: string;
    ErrorMessage?: string;
    StackTrace?: string;
    IsNonRetriable?: boolean;
    Properties?: Record<string, unknown> | null;
    InnerFailure?: FailureDetailsDto | null;
}
