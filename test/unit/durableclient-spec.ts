import { HttpRequest } from "@azure/functions";
import chai = require("chai");
import chaiString = require("chai-string");
import { DurableOrchestrationClient, HttpManagementPayload, OrchestrationClientInputData, OrchestrationRuntimeStatus } from "../../src/classes";
import nock = require("nock");

chai.use(chaiString);
const expect = chai.expect;

const externalOrigin = "https://durable.gov";
const externalBaseUrl = `${externalOrigin}/runtime/webhooks/durableTask`;
const testRpcOrigin = "http://127.0.0.1:17071";
const testRpcBaseUrl = `${testRpcOrigin}/durabletask/`;
const testTaskHubName = "MyTaskHub";
const testConnectionName = "MyStorageAccount";

// We start with the JSON that matches the expected contract.
const durableClientBindingInputJson = JSON.stringify({
    taskHubName: testTaskHubName,
    creationUrls: { },
    managementUrls: {
        id: "INSTANCEID",
        statusQueryGetUri: `${externalBaseUrl}/instances/INSTANCEID?taskHub=${testTaskHubName}&connection=${testConnectionName}`,
        sendEventPostUri: `${externalBaseUrl}/instances/INSTANCEID/raiseEvent/{eventName}?taskHub=${testTaskHubName}&connection=${testConnectionName}`,
        terminatePostUri: `${externalBaseUrl}/instances/INSTANCEID/?taskHub=${testTaskHubName}&connection=${testConnectionName}`,
        rewindPostUri: `${externalBaseUrl}/instances/INSTANCEID/?taskHub=${testTaskHubName}&connection=${testConnectionName}`,
        purgeHistoryDeleteUri: `${externalBaseUrl}/instances/INSTANCEID/?taskHub=${testTaskHubName}&connection=${testConnectionName}`,
    },
    baseUrl: externalBaseUrl,
    rpcBaseUrl: testRpcBaseUrl,
});

describe("Durable Client", () => {
    before(() => {
        if (!nock.isActive()) {
            nock.activate();
        }
    });

    after(() => {
        nock.restore();
    });

    describe("initialization", () => {
        it("deserializes the durable client JSON schema correctly", () => {
            // cast the JSON into the typed object
            const input = JSON.parse(durableClientBindingInputJson) as OrchestrationClientInputData;
            expect(input.taskHubName).to.be.equal(testTaskHubName);
            expect(input.rpcBaseUrl).to.be.equal(testRpcBaseUrl);
            expect(input.managementUrls).to.be.an("object");
            expect(input.managementUrls.id).to.be.equal("INSTANCEID");
            expect(input.managementUrls.statusQueryGetUri).to.startsWith(externalBaseUrl);
        });
    });

    describe("createCheckStatusResponse()", () => {
        it("does NOT reference the RPC endpoint", async () => {
            const input = JSON.parse(durableClientBindingInputJson) as OrchestrationClientInputData;
            const client = new DurableOrchestrationClient(input);
            const request: HttpRequest = {
                method: "GET",
                url: `${externalOrigin}/api/Foo`,
                headers: { },
                query: { },
                params: { },
            };

            const instanceId = "abc123";
            const response = client.createCheckStatusResponse(request, instanceId);
            const payload = response.body as HttpManagementPayload;

            expect(payload).is.not.undefined;
            expect(payload.id).to.be.equal(instanceId);

            // Verify that even when using local RPC, we still expose the external
            // URLs in the createCheckStatusResponse API result.
            expect(payload.purgeHistoryDeleteUri).to.startWith(externalBaseUrl);
            expect(payload.rewindPostUri).to.startWith(externalBaseUrl);
            expect(payload.sendEventPostUri).to.startWith(externalBaseUrl);
            expect(payload.statusQueryGetUri).to.startWith(externalBaseUrl);
            expect(payload.terminatePostUri).to.startWith(externalBaseUrl);
        });
    });

    describe("startNew()", () => {
        it("uses the RPC endpoint", async () => {
            const input = JSON.parse(durableClientBindingInputJson) as OrchestrationClientInputData;
            const client = new DurableOrchestrationClient(input);

            // The startNew() method should do a POST to http://127.0.0.1:17071/durabletask/orchestrators/MyFunction
            const functionName = "MyFunction";
            const expectedUrl = new URL(`${testRpcOrigin}/durabletask/orchestrators/${functionName}`);
            const expectedHeaders = { reqheaders: { "Content-Type": "application/json" } };

            const scope = nock(expectedUrl.origin, expectedHeaders)
                .post(expectedUrl.pathname)
                .reply(202, { id: "abc123" });

            const result = await client.startNew(functionName);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.equal("abc123");
        });
    });

    describe("raiseEvent()", () => {
        it("uses the RPC endpoint (no query params)", async () => {
            const input = JSON.parse(durableClientBindingInputJson) as OrchestrationClientInputData;
            const client = new DurableOrchestrationClient(input);

            // The raiseEvent() method should do a POST to http://127.0.0.1:17071/durabletask/instances/abc123/raiseEvent/MyEvent
            // with a application/json payload matching { "value": 5 }.
            const instanceId = "abc123";
            const eventName = "MyEvent";
            const eventData = { value: 5 };
            const expectedUrl = new URL(`${testRpcOrigin}/durabletask/instances/${instanceId}/raiseEvent/${eventName}`);
            const expectedHeaders = { reqheaders: { "Content-Type": "application/json" } };

            const scope = nock(expectedUrl.origin, expectedHeaders)
                .post(expectedUrl.pathname, eventData)
                .reply(202);

            const result = await client.raiseEvent(instanceId, eventName, eventData);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.undefined;
        });

        it("uses the RPC endpoint (with query params)", async () => {
            const input = JSON.parse(durableClientBindingInputJson) as OrchestrationClientInputData;
            const client = new DurableOrchestrationClient(input);

            // The raiseEvent() method should do a POST to http://127.0.0.1:17071/durabletask/instances/abc123/raiseEvent/MyEvent?taskHub=hub&connection=Storage
            // with a application/json payload matching { "value": 42 }.
            const instanceId = "abc123";
            const eventName = "MyEvent";
            const taskHub = "hub";
            const connection = "Storage";
            const eventData = { value: 42 };
            const expectedUrl = new URL(`${testRpcOrigin}/durabletask/instances/${instanceId}/raiseEvent/${eventName}`);
            const expectedHeaders = { reqheaders: { "Content-Type": "application/json" } };

            const scope = nock(expectedUrl.origin, expectedHeaders)
                .post(expectedUrl.pathname, eventData)
                .query({ taskHub, connection })
                .reply(202);

            const result = await client.raiseEvent(instanceId, eventName, eventData, taskHub, connection);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.undefined;
        });
    });

    describe("getStatus()", () => {
        it("uses the RPC endpoint (no query params)", async () => {
            const input = JSON.parse(durableClientBindingInputJson) as OrchestrationClientInputData;
            const client = new DurableOrchestrationClient(input);

            // The getStatus() method should do a GET to http://127.0.0.1:17071/durabletask/instances/abc123
            const instanceId = "abc123";
            const expectedUrl = new URL(`${testRpcOrigin}/durabletask/instances/${instanceId}`);

            const scope = nock(expectedUrl.origin)
                .get(expectedUrl.pathname)
                .reply(202, {
                    createdTime: "2020-01-01T05:00:00Z",
                    lastUpdatedTime: "2020-01-01T05:00:00Z",
                    runtimeStatus: "Running",
                });

            const result = await client.getStatus(instanceId);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.an("object");
        });

        it("uses the RPC endpoint (with all query params)", async () => {
            const input = JSON.parse(durableClientBindingInputJson) as OrchestrationClientInputData;
            const client = new DurableOrchestrationClient(input);

            // The getStatus() method should do a GET to http://127.0.0.1:17071/durabletask/instances/abc123?showInput=true&showHistory=true&showHistoryOutput=true
            const instanceId = "abc123";
            const expectedUrl = new URL(`${testRpcOrigin}/durabletask/instances/${instanceId}`);

            const scope = nock(expectedUrl.origin)
                .get(expectedUrl.pathname)
                .query({
                    showInput: true,
                    showHistory: true,
                    showHistoryOutput: true,
                })
                .reply(202, {
                    createdTime: "2020-01-01T05:00:00Z",
                    lastUpdatedTime: "2020-01-01T05:00:00Z",
                    runtimeStatus: "Pending",
                    history: [],
                });

            const result = await client.getStatus(instanceId, true, true, true);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.an("object");
        });
    });

    describe("getStatusBy()", () => {
        it("uses the RPC endpoint (all query params)", async () => {
            const input = JSON.parse(durableClientBindingInputJson) as OrchestrationClientInputData;
            const client = new DurableOrchestrationClient(input);

            // The getStatus() method should do a GET to http://127.0.0.1:17071/durabletask/instances/?createdTimeFrom=2020-01-01T00:00:00Z&createdTimeTo=2020-01-01T23:59:59Z&runtimeStatus=Pending,Running,Completed,Terminated,Failed
            const expectedUrl = new URL(`${testRpcOrigin}/durabletask/instances/`);
            const createdTimeFrom = "2020-01-01T00:00:00.000Z";
            const createdTimeTo = "2020-01-01T23:59:59.000Z";
            const runtimeStatus = "Pending,Running,Completed,Terminated,Failed";

            const scope = nock(expectedUrl.origin)
                .get(expectedUrl.pathname)
                .query({ createdTimeFrom, createdTimeTo, runtimeStatus })
                .reply(200, []);

            const statusList = runtimeStatus.split(",").map(
                (status) => OrchestrationRuntimeStatus[status as keyof typeof OrchestrationRuntimeStatus]);
            const result = await client.getStatusBy(
                new Date(createdTimeFrom),
                new Date(createdTimeTo),
                statusList);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.an("array");
        });
    });
});
