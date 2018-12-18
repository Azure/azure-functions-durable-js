import chai = require("chai");
import chaiAsPromised = require("chai-as-promised");
import "mocha";
import sinon = require("sinon");
import url = require("url");
import uuidv1 = require("uuid/v1");
import { DurableOrchestrationClient, DurableOrchestrationStatus, HttpCreationPayload,
    HttpManagementPayload, OrchestrationClientInputData, OrchestrationRuntimeStatus,
    WebhookClient } from "../../src/classes";

const expect = chai.expect;
chai.use(chaiAsPromised);

const eventNamePlaceholder = "{eventName}";
const functionPlaceholder = "{functionName}";
const hostPlaceholder = "HOST-PLACEHOLDER";
const idPlaceholder = "[/{instanceId}]";
const intervalPlaceholder = "{intervalInSeconds}";
const reasonPlaceholder = "{text}";
const timeoutPlaceholder = "{timeoutInSeconds}";
const taskHubPlaceholder = "TASK-HUB";
const connectionPlaceholder = "CONNECTION";

const webhookPath = "/runtime/webhooks/durabletask/";
const code = "code=6PDWS6KrNPAOv/hw7cTDgiabhQwKTQQEnEZptmIUawunGPpOFvzDRQ==";
const uriSuffix = `taskHub=${taskHubPlaceholder}&connection=${connectionPlaceholder}&${code}`;

const statusQueryGetUriTemplate = `${hostPlaceholder}${webhookPath}instances/${idPlaceholder}?${uriSuffix}`;
const sendEventPostUriTemplate = `${hostPlaceholder}${webhookPath}instances/${idPlaceholder}/raiseEvent/{eventName}?${uriSuffix}`; // tslint:disable-line max-line-length
const terminatePostUriTemplate = `${hostPlaceholder}${webhookPath}instances/${idPlaceholder}/terminate?reason=${reasonPlaceholder}&${uriSuffix}`; // tslint:disable-line max-line-length
const rewindPostUriTemplate = `${hostPlaceholder}${webhookPath}instances/${idPlaceholder}/rewind?reason=${reasonPlaceholder}&${uriSuffix}`; // tslint:disable-line max-line-length

const createPostUriTemplate = `${hostPlaceholder}${webhookPath}orchestrators/${functionPlaceholder}${idPlaceholder}?${code}`; // tslint:disable-line max-line-length
const waitOnPostUriTemplate = `${hostPlaceholder}${webhookPath}orchestrators/${functionPlaceholder}${idPlaceholder}?timeout=${timeoutPlaceholder}&pollingInterval=${intervalPlaceholder}&${code}`; // tslint:disable-line max-line-length

describe("Orchestration Client", () => {
    const notificationUrlHost = "http://localhost:7071";

    const defaultOrchestrationName = "TestOrchestration";
    const defaultRequestUrl = `${notificationUrlHost}/orchestrators/${defaultOrchestrationName}`;
    const defaultTaskHub = "TestTaskHub";
    const defaultConnection = "Storage";
    const defaultInstanceId = uuidv1();

    const defaultClientInputData = createOrchestrationClientInputData(
        idPlaceholder,
        notificationUrlHost,
        defaultTaskHub,
        defaultConnection,
    );

    describe("Constructor", () => {
        it("throws if clientData is undefined", async () => {
            expect(() => {
                const client = new DurableOrchestrationClient(undefined);
            }).to.throw(`context: Expected OrchestrationClientInputData but got undefined`);
        });
    });

    describe("Properties", () => {
        it("assigns taskHubName", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);
            expect(client.taskHubName).to.be.equal(defaultClientInputData.taskHubName);
        });
    });

    describe("createCheckStatusResponse()", () => {
        it(`returns a proper response object from request.url`, async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);
            const requestObj = {
                url: defaultRequestUrl,
                method: "GET",
            };

            const response = client.createCheckStatusResponse(requestObj, defaultInstanceId);

            const expectedPayload = createHttpManagementPayload(
                defaultInstanceId,
                notificationUrlHost,
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
            const client = new DurableOrchestrationClient(defaultClientInputData);
            const requestObj = {
                http: {
                    url: defaultRequestUrl,
                    method: "GET",
                },
            };

            const response = client.createCheckStatusResponse(requestObj, defaultInstanceId);

            const expectedPayload = createHttpManagementPayload(
                defaultInstanceId,
                notificationUrlHost,
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
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedPayload = createHttpManagementPayload(
                defaultInstanceId,
                notificationUrlHost,
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
            const client = new DurableOrchestrationClient(defaultClientInputData);
            const expectedPayload = createHttpManagementPayload(
                defaultInstanceId,
                notificationUrlHost,
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
            const client = new DurableOrchestrationClient(defaultClientInputData);

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
                .replace(idPlaceholder, defaultInstanceId));

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
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedStatuses: DurableOrchestrationStatus[] = [ ];
            this.getStub.resolves({ status: 202, body: expectedStatuses});

            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.statusQueryGetUri
                .replace(idPlaceholder, ""));

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
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedStatuses: DurableOrchestrationStatus[] = [ ];
            this.getStub.resolves({ status: 202, body: expectedStatuses});

            const createdTimeTo = new Date();
            const createdTimeFrom = new Date(createdTimeTo.getTime() - 1000 * 60 * 60 * 24 * 3);    // last three days
            const runtimeStatuses = [ OrchestrationRuntimeStatus.Failed, OrchestrationRuntimeStatus.Terminated ];

            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.statusQueryGetUri
                .replace(idPlaceholder, "")
                .concat(`&createdTimeFrom=${createdTimeFrom.toISOString()}`)
                .concat(`&createdTimeTo=${createdTimeTo.toISOString()}`)
                .concat("&runtimeStatus=Failed,Terminated"));

            const result = await client.getStatusBy(createdTimeFrom, createdTimeTo, runtimeStatuses);
            sinon.assert.calledWithExactly(this.getStub, sinon.match.has("href", expectedWebhookUrl.href));
            expect(result).to.be.deep.equal(expectedStatuses);
        });

        it("calls expected webhook with some filters", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedStatuses: DurableOrchestrationStatus[] = [ ];
            this.getStub.resolves({ status: 202, body: expectedStatuses });

            const runtimeStatuses = [ OrchestrationRuntimeStatus.Failed, OrchestrationRuntimeStatus.Terminated ];

            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.statusQueryGetUri
                .replace(idPlaceholder, "")
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
            const client = new DurableOrchestrationClient(defaultClientInputData);

            this.postStub.resolves({ status: 202, body: undefined});

            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.sendEventPostUri
                .replace(idPlaceholder, defaultInstanceId)
                .replace(eventNamePlaceholder, defaultTestEvent));

            const result = await client.raiseEvent(defaultInstanceId, defaultTestEvent, defaultTestData);
            sinon.assert.calledWithExactly(
                this.postStub,
                sinon.match.has("href", expectedWebhookUrl.href),
                defaultTestData);
            expect(result).to.be.equal(undefined);
        });

        it("calls expected webhook when task hub specified", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            this.postStub.resolves({ status: 202, body: undefined });

            const testTaskHub = "SpecialTaskHub";
            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.sendEventPostUri
                .replace(idPlaceholder, defaultInstanceId)
                .replace(eventNamePlaceholder, defaultTestEvent)
                .replace(defaultTaskHub, testTaskHub));

            const result = await client.raiseEvent(defaultInstanceId, defaultTestEvent, defaultTestData, testTaskHub);
            sinon.assert.calledWithExactly(
                this.postStub,
                sinon.match.has("href", expectedWebhookUrl.href),
                defaultTestData);
            expect(result).to.be.equal(undefined);
        });

        it("calls expected webhook when connection specified", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            this.postStub.resolves({ status: 202, body: undefined});

            const testConnection = "RainbowConnection";
            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.sendEventPostUri
                .replace(idPlaceholder, defaultInstanceId)
                .replace(eventNamePlaceholder, defaultTestEvent)
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
            const client = new DurableOrchestrationClient(defaultClientInputData);

            this.postStub.resolves({ status: 404, body: undefined });

            const id = "badId";
            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.sendEventPostUri
                .replace(idPlaceholder, id)
                .replace(eventNamePlaceholder, defaultTestEvent));

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
            const client = new DurableOrchestrationClient(defaultClientInputData);

            this.postStub.resolves({ status: 202, body: undefined });

            const testReason = "test";
            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.rewindPostUri
                .replace(idPlaceholder, defaultInstanceId)
                .replace(reasonPlaceholder, testReason));

            const result = await client.rewind(defaultInstanceId, testReason);
            sinon.assert.calledWithExactly(this.postStub, sinon.match.has("href", expectedWebhookUrl.href));
            expect(result).to.be.equal(undefined);
        });

        const invalidCodes = [ 404, 410, 500 ];
        invalidCodes.forEach((statusCode) => {
            it(`throws when webhook returns invalid status code ${statusCode}`, async () => {
                const client = new DurableOrchestrationClient(defaultClientInputData);

                this.postStub.resolves({ status: statusCode, body: undefined });

                const testId = "badId";
                const testReason = "test";
                const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.rewindPostUri
                    .replace(idPlaceholder, testId)
                    .replace(reasonPlaceholder, testReason));

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
            const client = new DurableOrchestrationClient(defaultClientInputData);

            this.postStub.resolves({
                status: 202,
                body: new HttpManagementPayload(defaultInstanceId, "", "", "", ""),
            });

            const functionName = defaultOrchestrationName;
            const expectedWebhookUrl = createInstanceWebhookUrl(notificationUrlHost, functionName);

            const result = await client.startNew(functionName);
            sinon.assert.calledWithExactly(this.postStub, sinon.match.has("href", expectedWebhookUrl.href), undefined);
            expect(result).to.equal(defaultInstanceId);
        });

        it("starts new instance with specific id and input", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            this.postStub.resolves({
                status: 202,
                body: new HttpManagementPayload(defaultInstanceId, "", "", "", ""),
            });

            const functionName = defaultOrchestrationName;
            const expectedWebhookUrl = createInstanceWebhookUrl(notificationUrlHost, functionName, defaultInstanceId);

            const testData = { key: "value" };
            const result = await client.startNew(functionName, defaultInstanceId, testData);
            sinon.assert.calledWithExactly(this.postStub, sinon.match.has("href", expectedWebhookUrl.href), testData);
            expect(result).to.equal(defaultInstanceId);
        });

        it("throws if webhook client returns error", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            this.postStub.resolves({ status: 500, body: undefined });

            const functionName = "BadOrchestration";
            const expectedWebhookUrl = createInstanceWebhookUrl(notificationUrlHost, functionName);

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
            const client = new DurableOrchestrationClient(defaultClientInputData);

            this.postStub.resolves({ status: 202, body: undefined });

            const testReason = "test";
            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.terminatePostUri
                .replace(idPlaceholder, defaultInstanceId)
                .replace(reasonPlaceholder, testReason));

            const result = await client.terminate(defaultInstanceId, testReason);
            sinon.assert.calledWithExactly(this.postStub, sinon.match.has("href", expectedWebhookUrl.href));
            expect(result).to.be.equal(undefined);
        });

        const invalidCodes = [ 404, 500 ];
        invalidCodes.forEach((statusCode) => {
            it(`throws when webhook returns invalid status code ${statusCode}`, async () => {
                const client = new DurableOrchestrationClient(defaultClientInputData);

                this.postStub.resolves({ status: 404, body: undefined });

                const id = "badId";
                const testReason = "test";
                const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.terminatePostUri
                    .replace(idPlaceholder, id)
                    .replace(reasonPlaceholder, testReason));

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
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const badInterval = 1e6;

            await expect(client.waitForCompletionOrCreateCheckStatusResponse(
                defaultRequest,
                defaultInstanceId,
                defaultTimeout,
                badInterval))
                .to.be.rejectedWith(`Total timeout ${defaultTimeout} (ms) should be bigger than retry timeout ${badInterval} (ms)`); // tslint:disable-line max-line-length
        });

        it("returns expected result for completed instance", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

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
            const client = new DurableOrchestrationClient(defaultClientInputData);

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
            const client = new DurableOrchestrationClient(defaultClientInputData);

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
            const client = new DurableOrchestrationClient(defaultClientInputData);

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
            const client = new DurableOrchestrationClient(defaultClientInputData);

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

            const httpManagementPayload = createHttpManagementPayload(
                defaultInstanceId,
                hostPlaceholder,
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
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const runningStatus = new DurableOrchestrationStatus(
                defaultOrchestrationName,
                defaultInstanceId,
                undefined,
                undefined,
                undefined,
                undefined,
                OrchestrationRuntimeStatus.Running,
            );

            const httpManagementPayload = createHttpManagementPayload(
                defaultInstanceId,
                hostPlaceholder,
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
        webhookUrl = waitOnPostUriTemplate
            .replace(timeoutPlaceholder, timeoutInSeconds.toString())
            .replace(intervalPlaceholder, intervalInSeconds.toString());
    } else {
        webhookUrl = createPostUriTemplate;
    }

    webhookUrl = webhookUrl
        .replace(hostPlaceholder, host)
        .replace(functionPlaceholder, functionName)
        .replace(idPlaceholder, (instanceId ? `/${instanceId}` : ""));

    return new url.URL(webhookUrl);
}

function createOrchestrationClientInputData(
    id: string,
    host: string,
    taskHub: string = taskHubPlaceholder,
    connection: string = connectionPlaceholder) {
    return new OrchestrationClientInputData(
        taskHub,
        createHttpCreationPayload(host, taskHub, connection),
        createHttpManagementPayload(id, host, taskHub, connection),
    );
}

function createHttpCreationPayload(host: string, taskHub: string, connection: string) {
    return new HttpCreationPayload(
        createPostUriTemplate
            .replace(hostPlaceholder, host)
            .replace(taskHubPlaceholder, taskHub)
            .replace(connectionPlaceholder, connection),
        waitOnPostUriTemplate
            .replace(hostPlaceholder, host)
            .replace(taskHubPlaceholder, taskHub)
            .replace(connectionPlaceholder, connection),
    );
}

function createHttpManagementPayload(id: string, host: string, taskHub: string, connection: string) {
    return new HttpManagementPayload(
        id,
        statusQueryGetUriTemplate
            .replace(hostPlaceholder, host)
            .replace(idPlaceholder, id)
            .replace(taskHubPlaceholder, taskHub)
            .replace(connectionPlaceholder, connection),
        sendEventPostUriTemplate
            .replace(hostPlaceholder, host)
            .replace(idPlaceholder, id)
            .replace(taskHubPlaceholder, taskHub)
            .replace(connectionPlaceholder, connection),
        terminatePostUriTemplate
            .replace(hostPlaceholder, host)
            .replace(idPlaceholder, id)
            .replace(taskHubPlaceholder, taskHub)
            .replace(connectionPlaceholder, connection),
        rewindPostUriTemplate
            .replace(hostPlaceholder, host)
            .replace(idPlaceholder, id)
            .replace(taskHubPlaceholder, taskHub)
            .replace(connectionPlaceholder, connection),
    );
}
