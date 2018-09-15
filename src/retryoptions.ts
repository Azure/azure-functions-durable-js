export class RetryOptions {
    public backoffCoefficient: number;
    public maxRetryIntervalInMilliseconds: number;
    public retryTimeoutInMilliseconds: number;

    constructor(
        public firstRetryIntervalInMilliseconds: number,
        public maxNumberOfAttempts: number,
    ) {
        if (firstRetryIntervalInMilliseconds <= 0) {
            throw new RangeError("firstRetryIntervalInMilliseconds value must be greater than 0.");
        }
    }
}
