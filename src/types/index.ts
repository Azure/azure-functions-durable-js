export * from "./activityTypes";
export * from "./durableClientTypes";
export * from "./entityTypes";
export * from "./orchestrationTypes";
export * from "./taskTypes";

/**
 * Retry options type
 */
export interface RetryOptions {
    /**
     * The retry backoff coefficinet
     */
    backoffCoefficient: number;
    /**
     *  The max retry interval (ms).
     */
    maxRetryIntervalInMilliseconds: number;
    /**
     * The timeout for retries (ms).
     */
    retryTimeoutInMilliseconds: number;
    /**
     * The first retry interval (ms). Must be greater than 0.
     */
    readonly firstRetryIntervalInMilliseconds: number;
    /**
     * The maximum number of attempts.
     */
    readonly maxNumberOfAttempts: number;
}
