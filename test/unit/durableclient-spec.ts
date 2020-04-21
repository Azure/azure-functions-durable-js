import { HttpRequest } from "@azure/functions";
import chai = require("chai");
import chaiString = require("chai-string");
import nock = require("nock");
import url = require("url");
import {
    DurableOrchestrationClient,
    EntityId,
    EntityStateResponse,
    HttpManagementPayload,
    OrchestrationClientInputData,
    OrchestrationRuntimeStatus,
    PurgeHistoryResult,
} from "../../src/classes";

chai.use(chaiString);
const expect = chai.expect;
const URL = url.URL;

// DNS failures are expected if we accidentally try to reach this fake domain (durable.gov).
const externalOrigin = "https://durable.gov";
const externalBaseUrl = `${externalOrigin}/runtime/webhooks/durableTask`;
const testRpcOrigin = "http://127.0.0.1:17071";
const testRpcBaseUrl = `${testRpcOrigin}/durabletask/`;
const testTaskHubName = "MyTaskHub";
const testConnectionName = "MyStorageAccount";

// We start with the JSON that matches the expected contract.
const durableClientBindingInputJson = JSON.stringify({
    taskHubName: testTaskHubName,
    creationUrls: {},
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

describe("Durable client RPC endpoint", () => {
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
                headers: {},
                query: {},
                params: {},
            };

            const instanceId = "abc123";
            const response = client.createCheckStatusResponse(request, instanceId);
            const payload = response.body as HttpManagementPayload;

            expect(payload).is.an("object");
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

            await client.raiseEvent(instanceId, eventName, eventData);
            expect(scope.isDone()).to.be.equal(true);
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

            await client.raiseEvent(instanceId, eventName, eventData, taskHub, connection);
            expect(scope.isDone()).to.be.equal(true);
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

            // The getStatusBy() method should do a GET to http://127.0.0.1:17071/durabletask/instances/?createdTimeFrom=2020-01-01T00:00:00Z&createdTimeTo=2020-01-01T23:59:59Z&runtimeStatus=Pending,Running,Completed,Terminated,Failed
            const expectedUrl = new URL(`${testRpcOrigin}/durabletask/instances/`);
            const createdTimeFrom = "2020-01-01T00:00:00.000Z";
            const createdTimeTo = "2020-01-01T23:59:59.000Z";
            const runtimeStatus = "Pending,Running,Completed,Terminated,Failed";

            const scope = nock(expectedUrl.origin)
                .get(expectedUrl.pathname)
                .query({ createdTimeFrom, createdTimeTo, runtimeStatus })
                .reply(200, []);

            const statusList = runtimeStatus
                .split(",")
                .map(status => OrchestrationRuntimeStatus[status as keyof typeof OrchestrationRuntimeStatus]);
            const result = await client.getStatusBy(new Date(createdTimeFrom), new Date(createdTimeTo), statusList);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.an("array");
        });
    });

    describe("terminate()", () => {
        it("uses the RPC endpoint", async () => {
            const input = JSON.parse(durableClientBindingInputJson) as OrchestrationClientInputData;
            const client = new DurableOrchestrationClient(input);

            // The terminate() method should do a POST to http://127.0.0.1:17071/durabletask/instances/abc123/terminate?reason=because
            const instanceId = "abc123";
            const reason = "because";
            const expectedUrl = new URL(`${testRpcOrigin}/durabletask/instances/${instanceId}/terminate?reason=${reason}`);

            const scope = nock(expectedUrl.origin)
                .post(expectedUrl.pathname + expectedUrl.search)
                .reply(202);

            await client.terminate(instanceId, reason);
            expect(scope.isDone()).to.be.equal(true);
        });
    });

    describe("purgeInstanceHistory[By]()", () => {
        it("uses the RPC endpoint (single instance)", async () => {
            const input = JSON.parse(durableClientBindingInputJson) as OrchestrationClientInputData;
            const client = new DurableOrchestrationClient(input);

            // The purgeInstanceHistory() method should do a DELETE to http://127.0.0.1:17071/durabletask/instances/abc123
            const instanceId = "abc123";
            const expectedUrl = new URL(`${testRpcOrigin}/durabletask/instances/${instanceId}`);

            const scope = nock(expectedUrl.origin)
                .delete(expectedUrl.pathname)
                .reply(200, { instancesDeleted: 1 });

            const result: PurgeHistoryResult = await client.purgeInstanceHistory(instanceId);
            expect(scope.isDone()).to.be.equal(true);
            expect(result.instancesDeleted).to.be.equal(1);
        });

        it("uses the RPC endpoint (multiple instances)", async () => {
            const input = JSON.parse(durableClientBindingInputJson) as OrchestrationClientInputData;
            const client = new DurableOrchestrationClient(input);

            // The purgeInstanceHistoryBy() method should do a DELETE to
            // http://127.0.0.1:17071/durabletask/instances/?createdTimeFrom=2020-01-01T00:00:00Z&createdTimeTo=2020-01-01T23:59:59Z&runtimeStatus=Pending,Running,Completed,Terminated,Failed
            const expectedUrl = new URL(`${testRpcOrigin}/durabletask/instances/`);
            const createdTimeFrom = "2020-01-01T00:00:00.000Z";
            const createdTimeTo = "2020-01-01T23:59:59.000Z";
            const runtimeStatus = "Pending,Running,Completed,Terminated,Failed";

            const scope = nock(expectedUrl.origin)
                .delete(expectedUrl.pathname)
                .query({ createdTimeFrom, createdTimeTo, runtimeStatus })
                .reply(200, { instancesDeleted: 10 });

            const statusList = runtimeStatus
                .split(",")
                .map(status => OrchestrationRuntimeStatus[status as keyof typeof OrchestrationRuntimeStatus]);
            const result: PurgeHistoryResult = await client.purgeInstanceHistoryBy(
                new Date(createdTimeFrom),
                new Date(createdTimeTo),
                statusList
            );
            expect(scope.isDone()).to.be.equal(true);
            expect(result.instancesDeleted).to.be.equal(10);
        });
    });

    describe("rewind()", () => {
        it("uses the RPC endpoint (no optional query params)", async () => {
            const input = JSON.parse(durableClientBindingInputJson) as OrchestrationClientInputData;
            const client = new DurableOrchestrationClient(input);

            // The rewind() method should do a POST to http://127.0.0.1:17071/durabletask/instances/abc123/rewind?reason=because
            const instanceId = "abc123";
            const reason = "because";
            const expectedUrl = new URL(`${testRpcOrigin}/durabletask/instances/${instanceId}/rewind?reason=${reason}`);

            const scope = nock(expectedUrl.origin)
                .post(expectedUrl.pathname + expectedUrl.search)
                .reply(202);

            await client.rewind(instanceId, reason);
            expect(scope.isDone()).to.be.equal(true);
        });

        it("uses the RPC endpoint (all query params)", async () => {
            const input = JSON.parse(durableClientBindingInputJson) as OrchestrationClientInputData;
            const client = new DurableOrchestrationClient(input);

            // The rewind() method should do a POST to http://127.0.0.1:17071/durabletask/instances/abc123/rewind?reason=because&taskHub=hub&connection=Storage
            const instanceId = "abc123";
            const reason = "because";
            const taskHub = "hub";
            const connection = "Storage";
            const expectedUrl = new URL(
                `${testRpcOrigin}/durabletask/instances/${instanceId}/rewind?reason=${reason}&taskHub=${taskHub}&connection=${connection}`
            );

            const scope = nock(expectedUrl.origin)
                .post(expectedUrl.pathname)
                .query({ reason, taskHub, connection })
                .reply(202);

            await client.rewind(instanceId, reason, taskHub, connection);
            expect(scope.isDone()).to.be.equal(true);
        });
    });

    describe("signalEntity()", () => {
        it("uses the RPC endpoint (no arguments)", async () => {
            const input = JSON.parse(durableClientBindingInputJson) as OrchestrationClientInputData;
            const client = new DurableOrchestrationClient(input);

            // The signalEntity() method should do a POST to http://127.0.0.1:17071/durabletask/entities/counter/abc123?op=MyEvent
            const entityId = new EntityId("counter", "abc123");
            const expectedUrl = new URL(`${testRpcOrigin}/durabletask/entities/${entityId.name}/${entityId.key}`);

            const scope = nock(expectedUrl.origin)
                .post(expectedUrl.pathname)
                .reply(202);

            await client.signalEntity(entityId);
            expect(scope.isDone()).to.be.equal(true);
        });

        it("uses the RPC endpoint (with all arguments)", async () => {
            const input = JSON.parse(durableClientBindingInputJson) as OrchestrationClientInputData;
            const client = new DurableOrchestrationClient(input);

            // The signalEntity() method should do a POST to http://127.0.0.1:17071/durabletask/entities/counter/abc123?op=incr&taskHub=hub&connection=Storage
            // with a application/json payload matching { "value": 42 }.
            const entityId = new EntityId("counter", "abc123");
            const taskHub = "hub";
            const connection = "Storage";
            const op = "incr";
            const payload = { value: 42 };
            const expectedUrl = new URL(
                `${testRpcOrigin}/durabletask/entities/${entityId.name}/${entityId.key}?op=${op}&taskHub=${taskHub}&connection=${connection}`
            );
            const expectedHeaders = { reqheaders: { "Content-Type": "application/json" } };

            const scope = nock(expectedUrl.origin, expectedHeaders)
                .post(expectedUrl.pathname, payload)
                .query({ op, taskHub, connection })
                .reply(202);

            await client.signalEntity(entityId, op, payload, taskHub, connection);
            expect(scope.isDone()).to.equal(true);
        });
    });

    describe("readEntityState()", () => {
        it("uses the RPC endpoint (no optional params)", async () => {
            const input = JSON.parse(durableClientBindingInputJson) as OrchestrationClientInputData;
            const client = new DurableOrchestrationClient(input);

            // The readEntityState() method should do a GET to http://127.0.0.1:17071/durabletask/entities/counter/abc123
            const entityId = new EntityId("counter", "abc123");
            const expectedUrl = new URL(`${testRpcOrigin}/durabletask/entities/${entityId.name}/${entityId.key}`);
            const expectedEntityState = 5;

            const scope = nock(expectedUrl.origin)
                .get(expectedUrl.pathname)
                .reply(200, expectedEntityState);

            const result: EntityStateResponse<number> = await client.readEntityState<number>(entityId);
            expect(scope.isDone()).to.equal(true);
            expect(result.entityExists).to.equal(true);
            expect(result.entityState).to.equal(expectedEntityState);
        });

        it("uses the RPC endpoint (with optional params)", async () => {
            const input = JSON.parse(durableClientBindingInputJson) as OrchestrationClientInputData;
            const client = new DurableOrchestrationClient(input);

            // The readEntityState() method should do a GET to http://127.0.0.1:17071/durabletask/entities/counter/abc123?taskHub=hub&connection=Storage
            const entityId = new EntityId("counter", "abc123");
            const expectedUrl = new URL(`${testRpcOrigin}/durabletask/entities/${entityId.name}/${entityId.key}`);
            const taskHub = "hub";
            const connection = "Storage";
            const expectedEntityState = { value: 42 };

            const scope = nock(expectedUrl.origin)
                .get(expectedUrl.pathname)
                .query({ taskHub, connection })
                .reply(200, expectedEntityState);

            const result = await client.readEntityState(entityId, taskHub, connection);
            expect(scope.isDone()).to.equal(true);
            expect(result.entityExists).to.equal(true);
            expect(result.entityState).to.deep.equal(expectedEntityState);
        });
    });
});
