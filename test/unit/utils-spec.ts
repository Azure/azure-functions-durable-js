import { expect } from "chai";
import "mocha";
import { Utils } from "../../src/classes";

describe("Utils", () => {
    describe("getInstancesOf()", () => {
        it("returns empty array when collection is undefined", async () => {

        });

        it("returns empty array when collection contains no instances of target type", async () => {

        });

        it("returns all instances of target type in collection", async () => {

        });
    });

    describe("hasAllPropertiesOf()", () => {
        it("returns false when obj is undefined", async () => {
            const refInstance = new TestType();
            const actualValue = Utils.hasAllPropertiesOf(refInstance, undefined);

            return expect(actualValue).to.be.false;
        });

        it("returns false when obj matches no properties of refInstance", async () => {

        });

        it("returns false when obj matches some properties of refInstance", async () => {

        });

        it("returns true when obj matches all properties of refInstance", async () => {

        });

        // TODO: primitives??
    });
});

class TestType {
    constructor(
        public property0: boolean = false,
        public property1: string = "",
        public property2?: unknown,
        public property3?: object,
    ) { }
}