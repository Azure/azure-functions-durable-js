import { Utils } from "./utils";
import * as types from "./types";

/**
 * Defines retry policies that can be passed as parameters to various
 * operations.
 */
export class RetryOptions implements types.RetryOptions {
    /** Gets or sets the backoff coefficient. */
    public backoffCoefficient: number;
    /** Gets or sets the max retry interval (ms). */
    public maxRetryIntervalInMilliseconds: number;
    /** Gets or sets the timeout for retries (ms). */
    public retryTimeoutInMilliseconds: number;

    /**
     * Creates a new instance of RetryOptions with the supplied first retry and
     * max attempts.
     * @param firstRetryIntervalInMilliseconds Must be greater than 0.
     */
    constructor(
        /**
         * Gets or sets the first retry interval (ms). Must be greater than
         * 0.
         */
        public readonly firstRetryIntervalInMilliseconds: number,
        /** Gets or sets the max number of attempts. */
        public readonly maxNumberOfAttempts: number
    ) {
        Utils.throwIfNotNumber(
            firstRetryIntervalInMilliseconds,
            "firstRetryIntervalInMilliseconds"
        );
        Utils.throwIfNotNumber(maxNumberOfAttempts, "maxNumberOfAttempts");

        if (firstRetryIntervalInMilliseconds <= 0) {
            throw new RangeError("firstRetryIntervalInMilliseconds value must be greater than 0.");
        }
    }
}
