import * as sinon from "sinon";
import * as target from "../DurableFunctionsOrchestratorJS/index";
import "mocha";
import { DummyOrchestrationContext } from "durable-functions";
import { expect } from "chai";

describe("Orchestrator function", () => {
    it("Should return the output of all activities it invoked", () => {
        const sandbox = sinon.createSandbox();

        // Invoking a DF orchestrator requires passing in a context object as an argument,
        // the dummy orchestration context provides us with one that can be easily mocked.
        const context = new DummyOrchestrationContext();

        // We can mock DF APIs directly on this object
        sandbox.stub(context.df, "callActivity").returns("Lima");

        // We invoke the orchestration function
        target.default(context);

        // We can find the returned values of the orchestration in the `.doneValue.output` field
        expect(context.doneValue.output).to.have.members(["Lima", "Lima", "Lima"]);
        // We find any exceptions in .err
        expect(context.err).to.be.equal(undefined);
    });
});
