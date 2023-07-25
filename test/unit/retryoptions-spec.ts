import { expect } from "chai";
import "mocha";
import { RetryOptions } from "../../src/retryoptions";

describe("RetryOptions", () => {
    it("throws if firstRetryIntervalInMilliseconds less than or equal to zero", async () => {
        expect(() => {
            new RetryOptions(0, 1);
        }).to.throw("firstRetryIntervalInMilliseconds value must be greater than 0.");
    });
});
