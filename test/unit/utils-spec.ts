import { expect } from "chai";
import "mocha";
import { Utils } from "../../src/classes";

describe("Utils", () => {
    describe("getInstancesOf()", () => {
        it("returns empty array when typeInstance is not object", () => {
            const result = Utils.getInstancesOf<boolean>([], true);
            return expect(result).to.be.an("array").that.is.empty;
        });

        it("returns empty array when collection is undefined", async () => {
            const result = Utils.getInstancesOf<TestType>(undefined, new TestType());
            return expect(result).to.be.an("array").that.is.empty;
        });

        it("returns empty array when typeInstance is undefined", async () => {
            const result = Utils.getInstancesOf([], undefined);
            return expect(result).to.be.an("array").that.is.empty;
        });

        it("returns empty array when collection contains no instances of target type", async () => {
            const collection = {
                obj1: new Date(),
                obj2: true,
                obj3: "blueberry",
            };

            const result = Utils.getInstancesOf(collection, new TestType());
            return expect(result).to.be.an("array").that.is.empty;
        });

        it("returns all instances of target type in collection", async () => {
            const instance1 = new TestType(true, "apple", 3);
            const instance2 = new TestType(false, "orange", "tomato");
            const collection = {
                obj1: instance1,
                obj2: "banana",
                obj3: undefined as unknown,
                obj4: instance2,
                obj5: 0,
            };

            const result = Utils.getInstancesOf(collection, new TestType());
            expect(result).to.be.deep.equal([ instance1, instance2 ]);
        });
    });

    describe("hasAllPropertiesOf()", () => {
        it("returns false when obj is undefined", async () => {
            const result = Utils.hasAllPropertiesOf(undefined, new TestType());
            return expect(result).to.be.false;
        });

        it("returns false when obj matches no properties of refInstance", async () => {
            const result = Utils.hasAllPropertiesOf<TestType>(33, new TestType());
            return expect(result).to.be.false;
        });

        it("returns false when obj matches some properties of refInstance", async () => {
            const obj = {
                property0: false,
            };

            const result = Utils.hasAllPropertiesOf<TestType>(obj, new TestType());
            return expect(result).to.be.false;
        });

        it("returns true when obj matches all properties of refInstance", async () => {
            const obj = {
                property0: false,
                property1: "",
                property2: 3,
                property3: new Date(),
            };

            const result = Utils.hasAllPropertiesOf<TestType>(obj, new TestType());
            return expect(result).to.be.be.true;
        });
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
