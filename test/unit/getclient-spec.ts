import { InvocationContext } from "@azure/functions";
import { expect } from "chai";
import chai = require("chai");
import chaiAsPromised = require("chai-as-promised");
import "mocha";
import "process";
import { DurableClientInput } from "durable-functions";
import { TestConstants } from "../testobjects/testconstants";
import { TestUtils } from "../testobjects/testutils";
import { getClient, input } from "../../src";
import { Constants } from "../../src/Constants";
import { OrchestrationClientInputData } from "../../src/durableClient/OrchestrationClientInputData";
import { DurableClient } from "../../src/durableClient/DurableClient";
import { DurableFunctionsClient } from "../../src/grpc";

chai.use(chaiAsPromised);

// eslint-disable-next-line @typescript-eslint/no-empty-function
describe("getClient()", () => {
    const defaultTaskHub = "TestTaskHub";
    const defaultConnection = "Storage";

    const defaultClientInputOptions: DurableClientInput = input.durableClient();

    const defaultClientInputData: OrchestrationClientInputData = TestUtils.createOrchestrationClientInputData(
        TestConstants.idPlaceholder,
        Constants.DefaultLocalOrigin,
        defaultTaskHub,
        defaultConnection
    );

    const v1ClientInputData: OrchestrationClientInputData = TestUtils.createV1OrchestrationClientInputData(
        TestConstants.idPlaceholder,
        Constants.DefaultLocalOrigin,
        defaultTaskHub,
        defaultConnection
    );

    const defaultContext: InvocationContext = new InvocationContext({
        options: {
            extraInputs: [defaultClientInputOptions],
        },
    });
    defaultContext.extraInputs.set(defaultClientInputOptions, defaultClientInputData);

    const v1Context: InvocationContext = new InvocationContext({
        options: {
            extraInputs: [defaultClientInputOptions],
        },
    });
    v1Context.extraInputs.set(defaultClientInputOptions, v1ClientInputData);

    it("throws if context.options is undefined", async () => {
        expect(() => {
            const context = new InvocationContext();
            getClient(context);
        }).to.throw(
            "Could not find a registered durable client input binding. Check your extraInputs definition when registering your function."
        );
    });

    it("throws if context.options does not contain valid durableClient input binding", async () => {
        expect(() => {
            const badInput = { name: "", type: "notDurableInput" };
            const badContext = new InvocationContext({ options: { extraInputs: [badInput] } });
            getClient(badContext);
        }).to.throw(
            "Could not find a registered durable client input binding. Check your extraInputs definition when registering your function."
        );
    });

    it("returns DurableClient if called with valid context", async () => {
        const client = getClient(defaultContext);
        expect(client).to.be.instanceOf(DurableClient);
    });

    it("returns DurableClient if called with V1 context", async () => {
        const client = getClient(v1Context);
        expect(client).to.be.instanceOf(DurableClient);
    });

    describe("Azure/azure-functions-durable-js#28 patch", () => {
        let WEBSITE_HOSTNAME: string | undefined;
        beforeEach(() => {
            WEBSITE_HOSTNAME = process.env.WEBSITE_HOSTNAME;
        });

        afterEach(() => {
            process.env.WEBSITE_HOSTNAME = WEBSITE_HOSTNAME;
        });

        it("corrects API endpoints if WEBSITE_HOSTNAME environment variable not found", async () => {
            delete process.env.WEBSITE_HOSTNAME;

            const badClientData: OrchestrationClientInputData = TestUtils.createOrchestrationClientInputData(
                TestConstants.idPlaceholder,
                "http://0.0.0.0:12345",
                defaultTaskHub,
                defaultConnection
            );

            const clientInput: DurableClientInput = input.durableClient();
            const badContext: InvocationContext = new InvocationContext({
                options: {
                    extraInputs: [clientInput],
                },
            });
            badContext.extraInputs.set(clientInput, badClientData);

            const client = getClient(badContext);

            const expectedUniqueWebhookOrigins: string[] = [Constants.DefaultLocalOrigin];
            expect(client.uniqueWebhookOrigins).to.deep.equal(expectedUniqueWebhookOrigins);
        });

        it("corrects API endpoints if WEBSITE_HOSTNAME environment variable is 0.0.0.0", async () => {
            // Azure Functions Core Tools sets WEBSITE_HOSTNAME to 0.0.0.0:{port} on startup
            process.env.WEBSITE_HOSTNAME = "0.0.0.0:12345";

            const badClientData: OrchestrationClientInputData = TestUtils.createOrchestrationClientInputData(
                TestConstants.idPlaceholder,
                `http://${process.env.WEBSITE_HOSTNAME}`,
                defaultTaskHub,
                defaultConnection
            );

            const clientInput: DurableClientInput = input.durableClient();
            const badContext: InvocationContext = new InvocationContext({
                options: {
                    extraInputs: [clientInput],
                },
            });
            badContext.extraInputs.set(clientInput, badClientData);

            const client = getClient(badContext);

            const expectedUniqueWebhookOrigins: string[] = [Constants.DefaultLocalOrigin];
            expect(client.uniqueWebhookOrigins).to.deep.equal(expectedUniqueWebhookOrigins);
        });
    });

    describe("gRPC mode (durableRequiresGrpc opt-in)", () => {
        const grpcClientData = {
            taskHubName: defaultTaskHub,
            connectionName: defaultConnection,
            rpcBaseUrl: "http://127.0.0.1:4001",
            requiredQueryStringParameters: "code=secret",
            httpBaseUrl: "http://localhost:7071/runtime/webhooks/durabletask",
        };

        function createGrpcContext(): InvocationContext {
            const clientInput: DurableClientInput = input.durableClient();
            const context: InvocationContext = new InvocationContext({
                options: {
                    extraInputs: [clientInput],
                },
            });
            context.extraInputs.set(clientInput, grpcClientData);
            return context;
        }

        it("returns a gRPC-backed DurableFunctionsClient when the payload carries rpcBaseUrl and no HTTP URLs", async () => {
            const client = getClient(createGrpcContext());

            try {
                expect(client).to.be.instanceOf(DurableFunctionsClient);
                const grpcClient = (client as unknown) as DurableFunctionsClient;
                expect(grpcClient.taskHubName).to.equal(defaultTaskHub);

                const payload = grpcClient.createHttpManagementPayload("instance-9");
                expect(payload.statusQueryGetUri).to.equal(
                    "http://localhost:7071/runtime/webhooks/durabletask/instances/instance-9?code=secret"
                );
            } finally {
                await ((client as unknown) as DurableFunctionsClient).stop();
            }
        });

        it("does not take the gRPC path for legacy payloads carrying management URLs", async () => {
            const client = getClient(defaultContext);
            expect(client).to.be.instanceOf(DurableClient);
            expect(client).to.not.be.instanceOf(DurableFunctionsClient);
        });
    });
});
