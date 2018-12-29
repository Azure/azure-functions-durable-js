import { expect } from "chai";
import "mocha";
import { Constants, RetryOptions } from "../../src/classes";

describe("RetryOptions", () => {
    it ("throws if firstRetryIntervalinMilliseconds less than or equal to zero", async () => {
        expect(() => {
            const retryOptions = new RetryOptions(0, 1);
        }).to.throw(Constants.InvalidFirstRetryIntervalValueMessage);
    });
});
