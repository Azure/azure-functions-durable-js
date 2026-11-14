/**
 * @hidden
 * CLR scheduled retry metadata serialized by the Functions extension.
 */
export interface RetryMetadataPayload {
    AttemptNumber: number;
    MaxAttempts: number;
    RetryGroupId: string;
}
