import chai = require("chai");
import chaiAsPromised = require("chai-as-promised");
import "mocha";
import { getClient } from "../../src";
import { Constants, DurableOrchestrationClient, OrchestrationClientInputData } from "../../src/classes";

const expect = chai.expect;
chai.use(chaiAsPromised);

describe("getClient()", () => {
    const defaultTaskHub = "TestTaskHub";
    const defaultContext = {
        bindings: {
            starter: new OrchestrationClientInputData(
                defaultTaskHub,
                {
                    createNewInstancePostUri: "",
                    waitOnNewInstancePostUri: "",
                },
                {
                    id: "",
                    statusQueryGetUri: "",
                    sendEventPostUri: "",
                    terminatePostUri: "",
                    rewindPostUri: "",
                },
            ),
        },
    };

    it("throws if context.bindings is undefined", async () => {
        expect(() => {
            getClient({});
        }).to.throw(Constants.OrchestrationClientNoBindingFoundMessage);
    });

    it("throws if context.bindings does not contain valid orchestrationClient input binding", async () => {
        expect(() => {
            const badContext = {
                bindings: {
                    orchestrationClient: { id: "" },
                },
            };
            getClient(badContext);
        }).to.throw(Constants.OrchestrationClientNoBindingFoundMessage);
    });

    it("returns DurableOrchestrationClient if called with valid context", async () => {
        const client = getClient(defaultContext);
        expect(client).to.be.instanceOf(DurableOrchestrationClient);
    });
});
