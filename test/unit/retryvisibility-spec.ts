import chai = require("chai");
import nock = require("nock");
import url = require("url");
import { OrchestrationClientInputData } from "../../src/durableClient/OrchestrationClientInputData";
import { DurableClient } from "../../src/durableClient/DurableClient";
import { getInstanceRetryHistory } from "../../src/retryVisibility";

const expect = chai.expect;
const URL = url.URL;

const externalOrigin = "https://durable.gov";
const externalBaseUrl = `${externalOrigin}/runtime/webhooks/durableTask`;
const testRpcOrigin = "http://127.0.0.1:17071";
const testRpcBaseUrl = `${testRpcOrigin}/durabletask/`;
const testTaskHubName = "MyTaskHub";
const testConnectionName = "MyStorageAccount";

// Same binding shape the DurableClient tests use: rpcBaseUrl present so getStatus
// takes the fast local RPC path that nock can intercept.
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
        suspendPostUri: `${externalBaseUrl}/instances/INSTANCEID/?taskHub=${testTaskHubName}&connection=${testConnectionName}`,
        resumePostUri: `${externalBaseUrl}/instances/INSTANCEID/?taskHub=${testTaskHubName}&connection=${testConnectionName}`,
    },
    baseUrl: externalBaseUrl,
    rpcBaseUrl: testRpcBaseUrl,
});

function makeClient(): DurableClient {
    const input = JSON.parse(durableClientBindingInputJson) as OrchestrationClientInputData;
    return new DurableClient(input);
}

function instanceUrl(instanceId: string): URL {
    return new URL(`${testRpcOrigin}/durabletask/instances/${instanceId}`);
}

describe("getInstanceRetryHistory()", () => {
    before(() => {
        if (!nock.isActive()) {
            nock.activate();
        }
    });

    after(() => {
        nock.restore();
    });

    afterEach(() => {
        nock.cleanAll();
    });

    // Regression guard. DurableClient.getStatus signals a missing instance by
    // THROWING an Error whose message contains "HTTP 404 response" — it does not
    // return undefined. getInstanceRetryHistory depends on that wording to map a
    // missing instance back to `undefined`. If the 404 message ever changes, this
    // test fails, catching a silent regression where a missing instance would
    // start throwing to callers instead of returning undefined.
    it("returns undefined when the instance does not exist (HTTP 404)", async () => {
        const client = makeClient();
        const instanceId = "missing-instance";
        const expectedUrl = instanceUrl(instanceId);

        const scope = nock(expectedUrl.origin).get(expectedUrl.pathname).query(true).reply(404);

        const result = await getInstanceRetryHistory(client, instanceId);

        expect(scope.isDone()).to.equal(true);
        expect(result).to.equal(undefined);
    });

    // Non-not-found failures must surface to the caller, not be swallowed as
    // "missing instance".
    it("propagates non-not-found errors (HTTP 500)", async () => {
        const client = makeClient();
        const instanceId = "boom";
        const expectedUrl = instanceUrl(instanceId);

        const scope = nock(expectedUrl.origin)
            .get(expectedUrl.pathname)
            .query(true)
            .reply(500, { error: "kaboom" });

        let caught: unknown;
        try {
            await getInstanceRetryHistory(client, instanceId);
        } catch (err) {
            caught = err;
        }

        expect(scope.isDone()).to.equal(true);
        expect(caught).to.be.instanceOf(Error);
        expect((caught as Error).message).to.contain("500");
    });

    it("projects retry history from history tags", async () => {
        const client = makeClient();
        const instanceId = "retried-instance";
        const expectedUrl = instanceUrl(instanceId);

        const scope = nock(expectedUrl.origin)
            .get(expectedUrl.pathname)
            .query(true)
            .reply(200, {
                name: "MyOrchestration",
                instanceId,
                input: null,
                output: null,
                createdTime: "2020-01-01T05:00:00Z",
                lastUpdatedTime: "2020-01-01T05:05:00Z",
                runtimeStatus: "Completed",
                history: [
                    {
                        EventType: "TaskScheduled",
                        EventId: 1,
                        Name: "FlakyActivity",
                        Tags: { "dt.retry.attempt": "1", "dt.retry.maxAttempts": "3" },
                    },
                    {
                        EventType: "TaskFailed",
                        TaskScheduledId: 1,
                    },
                    {
                        EventType: "TaskScheduled",
                        EventId: 2,
                        Name: "FlakyActivity",
                        Tags: { "dt.retry.attempt": "2", "dt.retry.maxAttempts": "3" },
                    },
                    {
                        EventType: "TaskCompleted",
                        TaskScheduledId: 2,
                    },
                ],
            });

        const result = await getInstanceRetryHistory(client, instanceId);

        expect(scope.isDone()).to.equal(true);
        if (result === undefined) {
            throw new Error("expected a retry history result, got undefined");
        }
        expect(result.instanceId).to.equal(instanceId);
        expect(result.retryMetadataAvailable).to.equal(true);
        expect(result.attempts.length).to.equal(2);
        // Only the second scheduling (attempt 2) counts as a retry (attempt > 1).
        expect(result.retryAttemptCount).to.equal(1);
        // The max attempt (3) never failed, so the max-attempts-reached flag is false.
        expect(result.retryMaxAttemptsReached).to.equal(false);
    });
});
