import { expect } from "chai";
import "mocha";
import { DurableEntityContext, EntityState, OperationResult } from "../../src/classes";
import { TestEntities } from "../testobjects/testentities";
import { TestEntityBatches  } from "../testobjects/testentitybatches";
import { StringStoreOperation  } from "../testobjects/testentityoperations";

describe("Entity", () => {
    it("StringStore entity with no initial state.", async () => {
        const entity = TestEntities.StringStore;
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

        expect(testData.output).to.be.deep.equal(
            mockContext.doneValue,
        );
    });

    it("StringStore entity with initial state.", async () => { 
        const entity = TestEntities.StringStore;
        let operations : StringStoreOperation[] = [];
        operations.push({ kind: "get"});

        const testData = TestEntityBatches.GetStringStoreBatch(operations, "Hello world");
        const mockContext = new MockContext({
            context: testData.input,
        });
        entity(mockContext);

        expect(testData.output).to.be.deep.equal(
            mockContext.doneValue,
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