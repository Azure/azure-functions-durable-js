import { Utils } from "./utils";
import * as types from "durable-functions";

export class RetryOptions implements types.RetryOptions {
    public backoffCoefficient: number;
    public maxRetryIntervalInMilliseconds: number;
    public retryTimeoutInMilliseconds: number;

    constructor(
        public readonly firstRetryIntervalInMilliseconds: number,
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
