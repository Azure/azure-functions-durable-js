import { expect } from "chai";
import "mocha";
import { DurableEntityContext, EntityState, IEntityFunctionContext } from "../../src/classes";
import { TestEntities } from "../testobjects/testentities";
import { TestEntityBatches } from "../testobjects/testentitybatches";
import { StringStoreOperation } from "../testobjects/testentityoperations";
import { BindingDefinition, ExecutionContext, Logger, HttpRequest } from "@azure/functions";

describe("Entity", () => {
    it("StringStore entity with no initial state.", async () => {
        const entity = TestEntities.StringStore;
        const operations: StringStoreOperation[] = [];
        operations.push({ kind: "set", value: "hello" });
        operations.push({ kind: "get" });
        operations.push({ kind: "set", value: "hello world" });
        operations.push({ kind: "get" });

        const testData = TestEntityBatches.GetStringStoreBatch(operations, undefined);
        const mockContext = new MockContext({
            context: testData.input,
        });
        entity(mockContext);

        expect(mockContext.doneValue).to.not.equal(undefined);

        if (mockContext.doneValue) {
            entityStateMatchesExpected(mockContext.doneValue, testData.output);
        }
    });

    it("StringStore entity with initial state.", async () => {
        const entity = TestEntities.StringStore;
        const operations: StringStoreOperation[] = [];
        operations.push({ kind: "get" });

        const testData = TestEntityBatches.GetStringStoreBatch(operations, "Hello world");
        const mockContext = new MockContext({
            context: testData.input,
        });
        entity(mockContext);

        expect(mockContext.doneValue).to.not.equal(undefined);

        if (mockContext.doneValue) {
            entityStateMatchesExpected(mockContext.doneValue, testData.output);
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

class MockContext implements IEntityFunctionContext {
    constructor(public bindings: IBindings, public doneValue?: EntityState, public err?: Error | string | null) {}
    public invocationId: string;
    public executionContext: ExecutionContext;
    public bindingData: { [key: string]: any };
    public bindingDefinitions: BindingDefinition[];
    public log: Logger;
    public req?: HttpRequest | undefined;
    public res?: { [key: string]: any } | undefined;
    public df: DurableEntityContext;

    public done(err?: Error | string | null, result?: EntityState): void {
        this.doneValue = result;
        this.err = err;
    }
}

interface IBindings {
    [key: string]: unknown;
}
