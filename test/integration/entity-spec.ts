import { expect } from "chai";
import "mocha";
import { EntityId, DurableEntityBindingInfo, DurableEntityContext, EntityState, Entity } from "../../src/classes";
import { TestEntities } from "../testobjects/testentities";
import { TestEntityBatches, StringStoreOperation,  } from "../testobjects/testentitybatches";

describe("Entity", () => {
    it("handles a simple entity function (no initial state)", async () => {
        const entity = TestEntities.StringStore;
        const name = "World";
        let operations : StringStoreOperation[] = [];
        operations.push({ kind: "set", value: "hello"});
        operations.push({ kind: "get"});
        operations.push({ kind: "set", value: "hello world"});
        operations.push({ kind: "get"});

        const testData = TestEntityBatches.GetStringStoreBatch( operations, null);
        const mockContext = new MockContext({
            context: testData.input,
        });
        entity(mockContext);

        expect(mockContext.doneValue).to.be.deep.equal(
            testData.output,
        );
    });
});

class MockContext {
    constructor(
        public bindings: IBindings,
        public df?: DurableEntityContext,
        public doneValue?: EntityState,
        public err?: Error | string | null,
    ) { }

    public done(err?: Error | string | null, result?: EntityState) {
        this.doneValue = result;
        this.err = err;
    }
}

interface IBindings {
    [key: string]: unknown;
}