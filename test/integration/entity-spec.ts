import { expect } from "chai";
import "mocha";
import { DummyEntityContext } from "../../src/util/testingUtils";
import { TestEntities } from "../testobjects/testentities";
import { TestEntityBatches } from "../testobjects/testentitybatches";
import { StringStoreOperation } from "../testobjects/testentityoperations";
import { EntityState } from "../../src/entities/entitystate";

describe("Entity", () => {
    it("StringStore entity with no initial state.", async () => {
        const entity = TestEntities.StringStore;
        const operations: StringStoreOperation[] = [];
        operations.push({ kind: "set", value: "hello" });
        operations.push({ kind: "get" });
        operations.push({ kind: "set", value: "hello world" });
        operations.push({ kind: "get" });
        const testData = TestEntityBatches.GetStringStoreBatch(operations, undefined);
        const mockContext = new DummyEntityContext<string>();
        const result = await entity(testData.input, mockContext);
        expect(result).to.not.be.undefined;
        if (result) {
            entityStateMatchesExpected(result, testData.output);
        }
    });
    it("StringStore entity with initial state.", async () => {
        const entity = TestEntities.StringStore;
        const operations: StringStoreOperation[] = [];
        operations.push({ kind: "get" });
        const testData = TestEntityBatches.GetStringStoreBatch(operations, "Hello world");
        const mockContext = new DummyEntityContext<string>();
        const result = await entity(testData.input, mockContext);
        expect(result).to.not.be.undefined;
        if (result) {
            entityStateMatchesExpected(result, testData.output);
        }
    });
    it("AsyncStringStore entity with no initial state.", async () => {
        const entity = TestEntities.AsyncStringStore;
        const operations: StringStoreOperation[] = [];
        operations.push({ kind: "set", value: "set 1" });
        operations.push({ kind: "get" });
        operations.push({ kind: "set", value: "set 2" });
        operations.push({ kind: "get" });
        const testData = TestEntityBatches.GetAsyncStringStoreBatch(operations, undefined);
        const mockContext = new DummyEntityContext<string>();
        const result = await entity(testData.input, mockContext);
        expect(result).to.not.be.undefined;
        if (result) {
            entityStateMatchesExpected(result, testData.output);
        }
    });
});

// Have to compare on an element by element basis as elapsed time is not deterministic.
function entityStateMatchesExpected(actual: EntityState, expected: EntityState): void {
    expect(actual.entityExists).to.be.equal(expected.entityExists);
    expect(actual.entityState).to.be.deep.equal(expected.entityState);
    expect(actual.signals).to.be.deep.equal(expected.signals);
    for (let i = 0; i < actual.results.length; i++) {
        expect(actual.results[i].isError).to.be.equal(expected.results[i].isError);
        expect(actual.results[i].result).to.be.deep.equal(expected.results[i].result);
    }
}
