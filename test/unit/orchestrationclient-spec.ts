import chai = require("chai");
import chaiAsPromised = require("chai-as-promised");
import "mocha";
import sinon = require("sinon");
import url = require("url");
import uuidv1 = require("uuid/v1");
import { Constants, DurableOrchestrationClient, DurableOrchestrationStatus, HttpCreationPayload,
    HttpManagementPayload, OrchestrationClientInputData, OrchestrationRuntimeStatus,
    WebhookClient } from "../../src/classes";
import { TestConstants } from "../testobjects/testconstants";
import { TestUtils } from "../testobjects/testutils";

const expect = chai.expect;
chai.use(chaiAsPromised);

describe("Orchestration Client", () => {
    const defaultOrchestrationName = "TestOrchestration";
    const defaultRequestUrl = `${Constants.DefaultLocalOrigin}/orchestrators/${defaultOrchestrationName}`;
    const defaultTaskHub = "TestTaskHub";
    const defaultConnection = "Storage";
    const defaultInstanceId = uuidv1();

    const defaultClientInputData = TestUtils.createOrchestrationClientInputData(
        TestConstants.idPlaceholder,
        Constants.DefaultLocalOrigin,
        defaultTaskHub,
        defaultConnection,
    );

    describe("Constructor", () => {
        it("throws if clientData is undefined", async () => {
            expect(() => {
                const client = new DurableOrchestrationClient(undefined, new WebhookClient());
            }).to.throw(`clientData: Expected OrchestrationClientInputData but got undefined`);
        });

        it("throws if webhookClient is undefined", async () => {
            expect(() => {
                const client = new DurableOrchestrationClient(defaultClientInputData, undefined);
            }).to.throw(`webhookClient: Expected WebhookClient but got undefined`);
        });
    });

    describe("Properties", () => {
        it("assigns taskHubName", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData, new WebhookClient());
            expect(client.taskHubName).to.be.equal(defaultClientInputData.taskHubName);
        });
    });

    describe("createCheckStatusResponse()", () => {
        it(`returns a proper response object from request.url`, async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData, new WebhookClient());
            const requestObj = {
                url: defaultRequestUrl,
                method: "GET",
            };

            const response = client.createCheckStatusResponse(requestObj, defaultInstanceId);

            const expectedPayload = TestUtils.createHttpManagementPayload(
                defaultInstanceId,
                Constants.DefaultLocalOrigin,
                defaultTaskHub,
                defaultConnection);
            const expectedResponse = {
                status: 202,
                body: expectedPayload,
                headers: {
                    "Content-Type": "application/json",
                    "Location": expectedPayload.statusQueryGetUri,
                    "Retry-After": 10,
                },
            };
            expect(response).to.be.deep.equal(expectedResponse);
        });

        it(`returns a proper response object from request.http.url`, async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData, new WebhookClient());
            const requestObj = {
                http: {
                    url: defaultRequestUrl,
                    method: "GET",
                },
            };

            const response = client.createCheckStatusResponse(requestObj, defaultInstanceId);

            const expectedPayload = TestUtils.createHttpManagementPayload(
                defaultInstanceId,
                Constants.DefaultLocalOrigin,
                defaultTaskHub,
                defaultConnection);
            const expectedResponse = {
                status: 202,
                body: expectedPayload,
                headers: {
                    "Content-Type": "application/json",
                    "Location": expectedPayload.statusQueryGetUri,
                    "Retry-After": 10,
                },
            };
            expect(response).to.be.deep.equal(expectedResponse);
        });

        it("returns a proper response object when request is undefined", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData, new WebhookClient());

            const expectedPayload = TestUtils.createHttpManagementPayload(
                defaultInstanceId,
                Constants.DefaultLocalOrigin,
                defaultTaskHub,
                defaultConnection);
            const expectedResponse = {
                status: 202,
                body: expectedPayload,
                headers: {
                    "Content-Type": "application/json",
                    "Location": expectedPayload.statusQueryGetUri,
                    "Retry-After": 10,
                },
            };

            const response = client.createCheckStatusResponse(undefined, defaultInstanceId);
            expect(response).to.be.deep.equal(expectedResponse);
        });
    });

    describe("createHttpManagementPayload()", () => {
        it("returns a proper payload", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData, new WebhookClient());
            const expectedPayload = TestUtils.createHttpManagementPayload(
                defaultInstanceId,
                Constants.DefaultLocalOrigin,
                defaultTaskHub,
                defaultConnection);

            const payload = client.createHttpManagementPayload(defaultInstanceId);
            expect(payload).to.be.deep.equal(expectedPayload);
        });
    });

    describe("getStatus()", () => {
        beforeEach(async () => {
            sinon.stub(WebhookClient.prototype, "get");
            this.getStub = (WebhookClient.prototype.get as sinon.SinonStub);
        });

        afterEach(async () => {
            this.getStub.restore();
        });

        it("calls expected webhook", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData, new WebhookClient());

            const expectedStatus = new DurableOrchestrationStatus(
                defaultOrchestrationName,
                defaultInstanceId,
                undefined,
                undefined,
                null,
                null,
                OrchestrationRuntimeStatus.Pending);
            this.getStub.resolves({ status: 202, body: expectedStatus});

            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.statusQueryGetUri
                .replace(TestConstants.idPlaceholder, defaultInstanceId));

            const result = await client.getStatus(defaultInstanceId);
            sinon.assert.calledWithExactly(this.getStub, sinon.match.has("href", expectedWebhookUrl.href));
            expect(result).to.be.deep.equal(expectedStatus);
        });

        // TODO: test status codes individually
    });

    describe("getStatusAll()", () => {
        beforeEach(async () => {
            sinon.stub(WebhookClient.prototype, "get");
            this.getStub = (WebhookClient.prototype.get as sinon.SinonStub);
        });

        afterEach(async () => {
            this.getStub.restore();
        });

        it("calls expected webhook", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData, new WebhookClient());

            const expectedStatuses: DurableOrchestrationStatus[] = [ ];
            this.getStub.resolves({ status: 202, body: expectedStatuses});

            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.statusQueryGetUri
                .replace(TestConstants.idPlaceholder, ""));

            const result = await client.getStatusAll();
            sinon.assert.calledWithExactly(this.getStub, sinon.match.has("href", expectedWebhookUrl.href));
            expect(result).to.be.deep.equal(expectedStatuses);
        });
    });

    describe("getStatusBy()", () => {
        beforeEach(async () => {
            sinon.stub(WebhookClient.prototype, "get");
            this.getStub = (WebhookClient.prototype.get as sinon.SinonStub);
        });

        afterEach(async () => {
            this.getStub.restore();
        });

        it("calls expected webhook with all filters", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData, new WebhookClient());

            const expectedStatuses: DurableOrchestrationStatus[] = [ ];
            this.getStub.resolves({ status: 202, body: expectedStatuses});

            const createdTimeTo = new Date();
            const createdTimeFrom = new Date(createdTimeTo.getTime() - 1000 * 60 * 60 * 24 * 3);    // last three days
            const runtimeStatuses = [ OrchestrationRuntimeStatus.Failed, OrchestrationRuntimeStatus.Terminated ];

            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.statusQueryGetUri
                .replace(TestConstants.idPlaceholder, "")
                .concat(`&createdTimeFrom=${createdTimeFrom.toISOString()}`)
                .concat(`&createdTimeTo=${createdTimeTo.toISOString()}`)
                .concat("&runtimeStatus=Failed,Terminated"));

            const result = await client.getStatusBy(createdTimeFrom, createdTimeTo, runtimeStatuses);
            sinon.assert.calledWithExactly(this.getStub, sinon.match.has("href", expectedWebhookUrl.href));
            expect(result).to.be.deep.equal(expectedStatuses);
        });

        it("calls expected webhook with some filters", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData, new WebhookClient());

            const expectedStatuses: DurableOrchestrationStatus[] = [ ];
            this.getStub.resolves({ status: 202, body: expectedStatuses });

            const runtimeStatuses = [ OrchestrationRuntimeStatus.Failed, OrchestrationRuntimeStatus.Terminated ];

            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.statusQueryGetUri
                .replace(TestConstants.idPlaceholder, "")
                .concat("&runtimeStatus=Failed,Terminated"));

            const result = await client.getStatusBy(undefined, undefined, runtimeStatuses);
            sinon.assert.calledWithExactly(this.getStub, sinon.match.has("href", expectedWebhookUrl.href));
            expect(result).to.be.deep.equal(expectedStatuses);
        });
    });

    describe("raiseEvent()", () => {
        const defaultTestEvent = "test";
        const defaultTestData = 42;

        beforeEach(async () => {
            sinon.stub(WebhookClient.prototype, "post");
            this.postStub = (WebhookClient.prototype.post as sinon.SinonStub);
        });

        afterEach(async () => {
            this.postStub.restore();
        });

        it("calls expected webhook and completes when event request accepted", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData, new WebhookClient());

            this.postStub.resolves({ status: 202, body: undefined});

            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.sendEventPostUri
                .replace(TestConstants.idPlaceholder, defaultInstanceId)
                .replace(TestConstants.eventNamePlaceholder, defaultTestEvent));

            const result = await client.raiseEvent(defaultInstanceId, defaultTestEvent, defaultTestData);
            sinon.assert.calledWithExactly(
                this.postStub,
                sinon.match.has("href", expectedWebhookUrl.href),
                defaultTestData);
            expect(result).to.be.equal(undefined);
        });

        it("calls expected webhook when task hub specified", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData, new WebhookClient());

            this.postStub.resolves({ status: 202, body: undefined });

            const testTaskHub = "SpecialTaskHub";
            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.sendEventPostUri
                .replace(TestConstants.idPlaceholder, defaultInstanceId)
                .replace(TestConstants.eventNamePlaceholder, defaultTestEvent)
                .replace(defaultTaskHub, testTaskHub));

            const result = await client.raiseEvent(defaultInstanceId, defaultTestEvent, defaultTestData, testTaskHub);
            sinon.assert.calledWithExactly(
                this.postStub,
                sinon.match.has("href", expectedWebhookUrl.href),
                defaultTestData);
            expect(result).to.be.equal(undefined);
        });

        it("calls expected webhook when connection specified", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData, new WebhookClient());

            this.postStub.resolves({ status: 202, body: undefined});

            const testConnection = "RainbowConnection";
            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.sendEventPostUri
                .replace(TestConstants.idPlaceholder, defaultInstanceId)
                .replace(TestConstants.eventNamePlaceholder, defaultTestEvent)
                .replace(defaultConnection, testConnection));

            const result = await client.raiseEvent(
                defaultInstanceId,
                defaultTestEvent,
                defaultTestData,
                undefined,
                testConnection);
            sinon.assert.calledWithExactly(
                this.postStub,
                sinon.match.has("href", expectedWebhookUrl.href),
                defaultTestData);
            expect(result).to.be.equal(undefined);
        });

        it("throws when specified instance not found", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData, new WebhookClient());

            this.postStub.resolves({ status: 404, body: undefined });

            const id = "badId";
            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.sendEventPostUri
                .replace(TestConstants.idPlaceholder, id)
                .replace(TestConstants.eventNamePlaceholder, defaultTestEvent));

            await expect (client.raiseEvent(id, defaultTestEvent, defaultTestData))
                .to.be.rejectedWith(`No instance with ID '${id}' found.`);
            sinon.assert.calledWithExactly(
                this.postStub,
                sinon.match.has("href", expectedWebhookUrl.href),
                defaultTestData);
        });
    });

    describe("rewind()", () => {
        beforeEach(async () => {
            sinon.stub(WebhookClient.prototype, "post");
            this.postStub = (WebhookClient.prototype.post as sinon.SinonStub);
        });

        afterEach(async () => {
            this.postStub.restore();
        });

        it("calls expected webhook and completes for valid instance", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData, new WebhookClient());

            this.postStub.resolves({ status: 202, body: undefined });

            const testReason = "test";
            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.rewindPostUri
                .replace(TestConstants.idPlaceholder, defaultInstanceId)
                .replace(TestConstants.reasonPlaceholder, testReason));

            const result = await client.rewind(defaultInstanceId, testReason);
            sinon.assert.calledWithExactly(this.postStub, sinon.match.has("href", expectedWebhookUrl.href));
            expect(result).to.be.equal(undefined);
        });

        const invalidCodes = [ 404, 410, 500 ];
        invalidCodes.forEach((statusCode) => {
            it(`throws when webhook returns invalid status code ${statusCode}`, async () => {
                const client = new DurableOrchestrationClient(defaultClientInputData, new WebhookClient());

                this.postStub.resolves({ status: statusCode, body: undefined });

                const testId = "badId";
                const testReason = "test";
                const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.rewindPostUri
                    .replace(TestConstants.idPlaceholder, testId)
                    .replace(TestConstants.reasonPlaceholder, testReason));

                await expect(client.rewind(testId, testReason)).to.be.rejectedWith(Error);
                sinon.assert.calledWithExactly(this.postStub, sinon.match.has("href", expectedWebhookUrl.href));
            });
        });
    });

    describe("startNew()", () => {
        beforeEach(async () => {
            sinon.stub(WebhookClient.prototype, "get");
            sinon.stub(WebhookClient.prototype, "post");
            this.getStub = (WebhookClient.prototype.get as sinon.SinonStub);
            this.postStub = (WebhookClient.prototype.post as sinon.SinonStub);
        });

        afterEach(async () => {
            this.getStub.restore();
            this.postStub.restore();
        });

        it("starts new instance with random id and no input", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData, new WebhookClient());

            this.postStub.resolves({
                status: 202,
                body: new HttpManagementPayload(defaultInstanceId, "", "", "", ""),
            });

            const functionName = defaultOrchestrationName;
            const expectedWebhookUrl = createInstanceWebhookUrl(Constants.DefaultLocalOrigin, functionName);

            const result = await client.startNew(functionName);
            sinon.assert.calledWithExactly(this.postStub, sinon.match.has("href", expectedWebhookUrl.href), undefined);
            expect(result).to.equal(defaultInstanceId);
        });

        it("starts new instance with specific id and input", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData, new WebhookClient());

            this.postStub.resolves({
                status: 202,
                body: new HttpManagementPayload(defaultInstanceId, "", "", "", ""),
            });

            const functionName = defaultOrchestrationName;
            const expectedWebhookUrl = createInstanceWebhookUrl(Constants.DefaultLocalOrigin, functionName, defaultInstanceId);

            const testData = { key: "value" };
            const result = await client.startNew(functionName, defaultInstanceId, testData);
            sinon.assert.calledWithExactly(this.postStub, sinon.match.has("href", expectedWebhookUrl.href), testData);
            expect(result).to.equal(defaultInstanceId);
        });

        it("throws if webhook client returns error", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData, new WebhookClient());

            this.postStub.resolves({ status: 500, body: undefined });

            const functionName = "BadOrchestration";
            const expectedWebhookUrl = createInstanceWebhookUrl(Constants.DefaultLocalOrigin, functionName);

            await expect(client.startNew(functionName)).to.be.rejectedWith(Error);
            sinon.assert.calledWithExactly(this.postStub, sinon.match.has("href", expectedWebhookUrl.href), undefined);
        });
    });

    describe("terminate()", () => {
        beforeEach(async () => {
            sinon.stub(WebhookClient.prototype, "post");
            this.postStub = (WebhookClient.prototype.post as sinon.SinonStub);
        });

        afterEach(async () => {
            this.postStub.restore();
        });

        it("calls expected webhook and completes for valid instance", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData, new WebhookClient());

            this.postStub.resolves({ status: 202, body: undefined });

            const testReason = "test";
            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.terminatePostUri
                .replace(TestConstants.idPlaceholder, defaultInstanceId)
                .replace(TestConstants.reasonPlaceholder, testReason));

            const result = await client.terminate(defaultInstanceId, testReason);
            sinon.assert.calledWithExactly(this.postStub, sinon.match.has("href", expectedWebhookUrl.href));
            expect(result).to.be.equal(undefined);
        });

        const invalidCodes = [ 404, 500 ];
        invalidCodes.forEach((statusCode) => {
            it(`throws when webhook returns invalid status code ${statusCode}`, async () => {
                const client = new DurableOrchestrationClient(defaultClientInputData, new WebhookClient());

                this.postStub.resolves({ status: 404, body: undefined });

                const id = "badId";
                const testReason = "test";
                const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.terminatePostUri
                    .replace(TestConstants.idPlaceholder, id)
                    .replace(TestConstants.reasonPlaceholder, testReason));

                await expect(client.terminate(id, testReason)).to.be.rejectedWith(Error);
                sinon.assert.calledWithExactly(this.postStub, sinon.match.has("href", expectedWebhookUrl.href));
            });
        });
    });

    describe("waitForCompletionOrCreateCheckStatusResponse()", () => {
        const defaultRequest = {
            url: defaultRequestUrl,
            method: "GET",
        };
        const defaultTimeout = 50;
        const defaultInterval = 10;

        beforeEach(async () => {
            sinon.stub(WebhookClient.prototype, "get");
            this.getStub = (WebhookClient.prototype.get as sinon.SinonStub);
        });

        afterEach(async () => {
            this.getStub.restore();
        });

        it("throws when retryIntervalInMilliseconds > timeoutInMilliseconds", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData, new WebhookClient());

            const badInterval = 1e6;

            await expect(client.waitForCompletionOrCreateCheckStatusResponse(
                defaultRequest,
                defaultInstanceId,
                defaultTimeout,
                badInterval))
                .to.be.rejectedWith(`Total timeout ${defaultTimeout} (ms) should be bigger than retry timeout ${badInterval} (ms)`); // tslint:disable-line max-line-length
        });

        it("returns expected result for completed instance", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData, new WebhookClient());

            const expectedOutput = 42;
            this.getStub.resolves({
                status: 202,
                body: new DurableOrchestrationStatus(
                    defaultOrchestrationName,
                    defaultInstanceId,
                    undefined,
                    undefined,
                    undefined,
                    expectedOutput,
                    OrchestrationRuntimeStatus.Completed,
                ),
            });

            const expectedResponse = {
                status: 200,
                body: JSON.stringify(expectedOutput),
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": 2,
                },
            };

            const res = await client.waitForCompletionOrCreateCheckStatusResponse(
                defaultRequest,
                defaultInstanceId,
                defaultTimeout,
                defaultInterval);
            expect(res).to.be.deep.equal(expectedResponse);
        });

        it("returns expected result for canceled instance", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData, new WebhookClient());

            const expectedStatus = new DurableOrchestrationStatus(
                defaultOrchestrationName,
                defaultInstanceId,
                undefined,
                undefined,
                undefined,
                undefined,
                OrchestrationRuntimeStatus.Canceled,
            );
            this.getStub.resolves({
                status: 200,
                body: expectedStatus,
            });

            const expectedStatusAsJson = JSON.stringify(expectedStatus);
            const expectedResponse = {
                status: 200,
                body: expectedStatusAsJson,
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": expectedStatusAsJson.length,
                },
            };

            const res = await client.waitForCompletionOrCreateCheckStatusResponse(
                defaultRequest,
                defaultInstanceId,
                defaultTimeout,
                defaultInterval);
            expect(res).to.be.deep.equal(expectedResponse);
        });

        it("returns expected result for terminated instance", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData, new WebhookClient());

            const expectedStatus = new DurableOrchestrationStatus(
                defaultOrchestrationName,
                defaultInstanceId,
                undefined,
                undefined,
                undefined,
                undefined,
                OrchestrationRuntimeStatus.Terminated,
            );
            this.getStub.resolves({
                status: 200,
                body: expectedStatus,
            });

            const expectedStatusAsJson = JSON.stringify(expectedStatus);
            const expectedResponse = {
                status: 200,
                body: expectedStatusAsJson,
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": expectedStatusAsJson.length,
                },
            };

            const res = await client.waitForCompletionOrCreateCheckStatusResponse(
                defaultRequest,
                defaultInstanceId,
                defaultTimeout,
                defaultInterval);
            expect(res).to.be.deep.equal(expectedResponse);
        });

        it("returns expected result for failed instance", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData, new WebhookClient());

            const expectedStatus = new DurableOrchestrationStatus(
                defaultOrchestrationName,
                defaultInstanceId,
                undefined,
                undefined,
                undefined,
                undefined,
                OrchestrationRuntimeStatus.Failed,
            );
            this.getStub.resolves({
                status: 200,
                body: expectedStatus,
            });

            const expectedStatusAsJson = JSON.stringify(expectedStatus);
            const expectedResponse = {
                status: 500,
                body: expectedStatusAsJson,
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": expectedStatusAsJson.length,
                },
            };

            const res = await client.waitForCompletionOrCreateCheckStatusResponse(
                defaultRequest,
                defaultInstanceId,
                defaultTimeout,
                defaultInterval);
            expect(res).to.be.deep.equal(expectedResponse);
        });

        it("continues polling for running instance", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData, new WebhookClient());

            const expectedOutput = 42;

            const runningStatus = new DurableOrchestrationStatus(
                defaultOrchestrationName,
                defaultInstanceId,
                undefined,
                undefined,
                undefined,
                undefined,
                OrchestrationRuntimeStatus.Running,
            );
            const completedStatus = new DurableOrchestrationStatus(
                defaultOrchestrationName,
                defaultInstanceId,
                undefined,
                undefined,
                undefined,
                expectedOutput,
                OrchestrationRuntimeStatus.Completed,
            );

            const httpManagementPayload = TestUtils.createHttpManagementPayload(
                defaultInstanceId,
                TestConstants.hostPlaceholder,
                defaultTaskHub,
                defaultConnection);
            this.getStub.onFirstCall().resolves({
                status: 202,
                body: runningStatus,
                headers: {
                    "Content-Type": "application/json",
                    "Location": httpManagementPayload.statusQueryGetUri,
                    "Retry-After": 10,
                },
            });
            this.getStub.onSecondCall().resolves({
                status: 200,
                body: completedStatus,
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": 2,
                },
            });

            const expectedResponse = {
                status: 200,
                body: JSON.stringify(expectedOutput),
                headers:                 {
                    "Content-Type": "application/json",
                    "Content-Length": 2,
                },
            };

            const res = await client.waitForCompletionOrCreateCheckStatusResponse(
                defaultRequest,
                defaultInstanceId,
                defaultTimeout,
                defaultInterval);
            sinon.assert.calledTwice(this.getStub);
            expect(res).to.be.deep.equal(expectedResponse);
        });

        it("returns check status response if timeout expires", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData, new WebhookClient());

            const runningStatus = new DurableOrchestrationStatus(
                defaultOrchestrationName,
                defaultInstanceId,
                undefined,
                undefined,
                undefined,
                undefined,
                OrchestrationRuntimeStatus.Running,
            );

            const httpManagementPayload = TestUtils.createHttpManagementPayload(
                defaultInstanceId,
                TestConstants.hostPlaceholder,
                defaultTaskHub,
                defaultConnection);
            this.getStub.resolves({
                status: 202,
                body: runningStatus,
                headers: {
                    "Content-Type": "application/json",
                    "Location": httpManagementPayload.statusQueryGetUri,
                    "Retry-After": 10,
                },
            });

            const expectedResponse = client.createCheckStatusResponse(defaultRequest, defaultInstanceId);

            const res = await client.waitForCompletionOrCreateCheckStatusResponse(
                defaultRequest,
                defaultInstanceId,
                defaultTimeout,
                defaultInterval);
            expect(res).to.be.deep.equal(expectedResponse);
        });
    });
});

function createInstanceWebhookUrl(
    host: string,
    functionName: string,
    instanceId?: string,
    timeoutInSeconds?: number,
    intervalInSeconds?: number) {
    let webhookUrl = "";
    if (timeoutInSeconds && intervalInSeconds) {
        webhookUrl = TestConstants.waitOnPostUriTemplate
            .replace(TestConstants.timeoutPlaceholder, timeoutInSeconds.toString())
            .replace(TestConstants.intervalPlaceholder, intervalInSeconds.toString());
    } else {
        webhookUrl = TestConstants.createPostUriTemplate;
    }

    webhookUrl = webhookUrl
        .replace(TestConstants.hostPlaceholder, host)
        .replace(TestConstants.functionPlaceholder, functionName)
        .replace(TestConstants.idPlaceholder, (instanceId ? `/${instanceId}` : ""));

    return new url.URL(webhookUrl);
}
