import chai = require("chai");
import chaiAsPromised = require("chai-as-promised");
import "mocha";
import "process";
import { getClient } from "../../src";
import { Constants, DurableOrchestrationClient } from "../../src/classes";
import { TestConstants } from "../testobjects/testconstants";
import { TestUtils } from "../testobjects/testutils";

const expect = chai.expect;
chai.use(chaiAsPromised);

describe("getClient()", () => {
    const defaultTaskHub = "TestTaskHub";
    const defaultConnection = "Storage";

    const defaultClientInputData = TestUtils.createOrchestrationClientInputData(
        TestConstants.idPlaceholder,
        Constants.DefaultLocalOrigin,
        defaultTaskHub,
        defaultConnection
    );

    const v1ClientInputData = TestUtils.createV1OrchestrationClientInputData(
        TestConstants.idPlaceholder,
        Constants.DefaultLocalOrigin,
        defaultTaskHub,
        defaultConnection
    );

    const defaultContext = {
        bindings: {
            starter: defaultClientInputData,
        },
    };

    const v1Context = {
        bindings: {
            starter: v1ClientInputData,
        },
    };

    it("throws if context.bindings is undefined", async () => {
        expect(() => {
            getClient({});
        }).to.throw(
            "An orchestration client function must have an orchestrationClient input binding. Check your function.json definition."
        );
    });

    it("throws if context.bindings does not contain valid orchestrationClient input binding", async () => {
        expect(() => {
            const badContext = {
                bindings: {
                    orchestrationClient: { id: "" },
                },
            };
            getClient(badContext);
        }).to.throw(
            "An orchestration client function must have an orchestrationClient input binding. Check your function.json definition."
        );
    });

    it("returns DurableOrchestrationClient if called with valid context", async () => {
        const client = getClient(defaultContext);
        expect(client).to.be.instanceOf(DurableOrchestrationClient);
    });

    it("returns DurableOrchestrationClient if called with V1 context", async () => {
        const client = getClient(v1Context);
        expect(client).to.be.instanceOf(DurableOrchestrationClient);
    });

    describe("Azure/azure-functions-durable-js#28 patch", () => {
        beforeEach(() => {
            this.WEBSITE_HOSTNAME = process.env.WEBSITE_HOSTNAME;
        });

        afterEach(() => {
            process.env.WEBSITE_HOSTNAME = this.WEBSITE_HOSTNAME;
        });

        it("corrects API endpoints if WEBSITE_HOSTNAME environment variable not found", async () => {
            delete process.env.WEBSITE_HOSTNAME;

            const badContext = {
                bindings: {
                    starter: TestUtils.createOrchestrationClientInputData(
                        TestConstants.idPlaceholder,
                        "http://0.0.0.0:12345",
                        defaultTaskHub,
                        defaultConnection
                    ),
                },
            };

            const client = getClient(badContext);

            const expectedUniqueWebhookOrigins: string[] = [Constants.DefaultLocalOrigin];
            expect(client.uniqueWebhookOrigins).to.deep.equal(expectedUniqueWebhookOrigins);
        });

        it("corrects API endpoints if WEBSITE_HOSTNAME environment variable is 0.0.0.0", async () => {
            // Azure Functions Core Tools sets WEBSITE_HOSTNAME to 0.0.0.0:{port} on startup
            process.env.WEBSITE_HOSTNAME = "0.0.0.0:12345";

            const badContext = {
                bindings: {
                    starter: TestUtils.createOrchestrationClientInputData(
                        TestConstants.idPlaceholder,
                        `http://${process.env.WEBSITE_HOSTNAME}`,
                        defaultTaskHub,
                        defaultConnection
                    ),
                },
            };

            const client = getClient(badContext);

            const expectedUniqueWebhookOrigins: string[] = [Constants.DefaultLocalOrigin];
            expect(client.uniqueWebhookOrigins).to.deep.equal(expectedUniqueWebhookOrigins);
        });
    });
});
