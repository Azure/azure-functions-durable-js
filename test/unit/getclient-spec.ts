import chai = require("chai");
import chaiAsPromised = require("chai-as-promised");
import "mocha";
import "process";
import sinon = require("sinon");
import url = require("url");
import uuidv1 = require("uuid/v1");
import { getClient } from "../../src";
import { Constants, DurableOrchestrationClient, OrchestrationClientInputData, WebhookClient } from "../../src/classes";
import { TestConstants } from "../testobjects/testconstants";
import { TestUtils } from "../testobjects/testutils";

const expect = chai.expect;
chai.use(chaiAsPromised);

describe("getClient()", () => {
    const defaultTaskHub = "TestTaskHub";
    const defaultConnection = "Storage";
    const defaultInstanceId = uuidv1();

    const defaultClientInputData = TestUtils.createOrchestrationClientInputData(
        TestConstants.idPlaceholder,
        Constants.DefaultLocalOrigin,
        defaultTaskHub,
        defaultConnection);

    const defaultContext = {
        bindings: {
            starter: defaultClientInputData,
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

    describe("Azure/azure-functions-durable-js#28 patch", () => {
        beforeEach(() => {
            this.WEBSITE_HOSTNAME = process.env.WEBSITE_HOSTNAME;
            delete process.env.WEBSITE_HOSTNAME;
        });

        afterEach(() => {
            process.env.WEBSITE_HOSTNAME = this.WEBSITE_HOSTNAME;
        });

        it("corrects API endpoints if WEBSITE_HOSTNAME environment variable not found", async () => {
            const badContext = {
                bindings: {
                    starter: TestUtils.createOrchestrationClientInputData(
                        TestConstants.idPlaceholder,
                        "http://0.0.0.0:12345",
                        defaultTaskHub,
                        defaultConnection,
                    ),
                },
            };

            const client = getClient(badContext);

            const expectedUniqueWebhookOrigins: string[] = [ Constants.DefaultLocalOrigin ];
            expect(client.uniqueWebhookOrigins).to.deep.equal(expectedUniqueWebhookOrigins);
        });
    });
});
