import chai = require("chai");
import chaiAsPromised = require("chai-as-promised");
import "mocha";
import * as sinon from "sinon";
import * as uuidv1 from "uuid/v1";
import { Constants, DurableOrchestrationStatus, HttpCreationPayload, HttpManagementPayload,
    HttpResponse, DurableOrchestrationClient, OrchestrationClientInputData, OrchestrationRuntimeStatus,
    WebhookClient } from "../../src/classes";

const expect = chai.expect;
chai.use(chaiAsPromised);

const eventNamePlaceholder = "{eventName}";
const functionPlaceholder = "{functionName}";
const hostPlaceholder = "HOST-PLACEHOLDER";
const idPlaceholder = "[/{instanceId}]";
const intervalPlaceholder = "{intervalInSeconds}";
const reasonPlaceholder = "{reason}";
const timeoutPlaceholder = "{timeoutInSeconds}";
const taskHubPlaceholder = "TASK-HUB";
const connectionPlaceholder = "CONNECTION";

const webhookPath = "/runtime/webhooks/durabletask/";
const code = "code=6PDWS6KrNPAOv/hw7cTDgiabhQwKTQQEnEZptmIUawunGPpOFvzDRQ==";
const uriSuffix = `taskHub=${taskHubPlaceholder}&connection=${connectionPlaceholder}&${code}`;

const statusQueryGetUriTemplate = `${hostPlaceholder}${webhookPath}instances/${idPlaceholder}?${uriSuffix}`;
const sendEventPostUriTemplate = `${hostPlaceholder}${webhookPath}instances/${idPlaceholder}/raiseEvent/{eventName}?${uriSuffix}`; // tslint:disable-line max-line-length
const terminatePostUriTemplate = `${hostPlaceholder}${webhookPath}instances/${idPlaceholder}/terminate?reason={reason}&${uriSuffix}`; // tslint:disable-line max-line-length
const rewindPostUriTemplate = `${hostPlaceholder}${webhookPath}instances/${idPlaceholder}/rewind?reason={text}&${uriSuffix}`; // tslint:disable-line max-line-length

const createPostUriTemplate = `${hostPlaceholder}${webhookPath}orchestrators/${functionPlaceholder}${idPlaceholder}?${code}`; // tslint:disable-line max-line-length
const waitOnPostUriTemplate = `${hostPlaceholder}${webhookPath}orchestrators/${functionPlaceholder}${idPlaceholder}?timeout=${timeoutPlaceholder}&pollingInterval=${intervalPlaceholder}&${code}`; // tslint:disable-line max-line-length

describe("Orchestration Client", () => {
    const notificationUrlHost = "http://localhost:7071";

    const defaultOrchestrationName = "TestOrchestration";
    const defaultRequestUrl = `${notificationUrlHost}/orchestrators/${defaultOrchestrationName}`;
    const defaultTaskHub = "TestTaskHub";
    const defaultConnection = "Storage";
    const defaultInstanceId = uuidv1();

    const defaultContext = {
        bindings: {
            starter: createOrchestrationClientInputData(
                idPlaceholder,
                notificationUrlHost,
                defaultTaskHub,
                defaultConnection,
            ),
        },
    };

    describe("Constructor", () => {
        it("throws if context is undefined", async () => {
            expect(() => {
                const client = new DurableOrchestrationClient(undefined);
            }).to.throw("context must have a value.");
        });

        it("throws if context.bindings is undefined", async () => {
            expect(() => {
                const client = new DurableOrchestrationClient({});
            }).to.throw(Constants.OrchestrationClientNoBindingFoundMessage);
        });

        it("throws if context.bindings does not contain valid orchestrationClient input binding", async () => {
            expect(() => {
                const badContext = {
                    bindings: {
                        orchestrationClient: { id: "" },
                    },
                };
                const client = new DurableOrchestrationClient(badContext);
            }).to.throw(Constants.OrchestrationClientNoBindingFoundMessage);
        });

        it("initializes if context.bindings contains valid orchestrationClient input binding", async () => {
            expect(() => {
                const client = new DurableOrchestrationClient(defaultContext);
            }).to.not.throw(Constants.OrchestrationClientNoBindingFoundMessage);
        });
    });

    describe("Properties", () => {
        it("assigns taskHubName", async () => {
            const client = new DurableOrchestrationClient(defaultContext);
            expect(client.taskHubName).to.be.equal(defaultTaskHub);
        });
    });

    describe("createCheckStatusResponse()", () => {
        it(`returns a proper response object from request.url`, async () => {
            const client = new DurableOrchestrationClient(defaultContext);
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

        it("returns a proper response object when request is undefined", async () => {
            const client = new DurableOrchestrationClient(defaultContext);

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
            const client = new DurableOrchestrationClient(defaultContext);
            const payload = client.createHttpManagementPayload(defaultInstanceId);

            const expectedPayload = createHttpManagementPayload(
                defaultInstanceId,
                notificationUrlHost,
                defaultTaskHub,
                defaultConnection);
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
            const context = defaultContext;
            const webhookUrl = new URL(context.bindings.starter.managementUrls.statusQueryGetUri
                .replace(idPlaceholder, defaultInstanceId));

            const client = new DurableOrchestrationClient(context);
            const expectedStatus = new DurableOrchestrationStatus(
                defaultOrchestrationName,
                defaultInstanceId,
                undefined,
                undefined,
                null,
                null,
                OrchestrationRuntimeStatus.Pending);
            this.getStub.resolves(new HttpResponse(202, expectedStatus));

            const result = await client.getStatus(defaultInstanceId);
            sinon.assert.calledWithExactly(this.getStub, webhookUrl);
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
            const context = defaultContext;
            const webhookUrl = new URL(context.bindings.starter.managementUrls.statusQueryGetUri
                .replace(idPlaceholder, ""));

            const client = new DurableOrchestrationClient(context);
            const expectedStatuses: DurableOrchestrationStatus[] = [ ];
            this.getStub.resolves(new HttpResponse(202, expectedStatuses));

            const result = await client.getStatusAll();
            sinon.assert.calledWithExactly(this.getStub, webhookUrl);
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
            const context = defaultContext;

            const createdTimeTo = new Date();
            const createdTimeFrom = new Date(createdTimeTo.getTime() - 1000 * 60 * 60 * 24 * 3);    // last three days
            const runtimeStatuses = [ OrchestrationRuntimeStatus.Failed, OrchestrationRuntimeStatus.Terminated ];
            const webhookUrl = new URL(context.bindings.starter.managementUrls.statusQueryGetUri
                .replace(idPlaceholder, "")
                .concat(`&createdTimeFrom=${createdTimeFrom.toISOString()}`)
                .concat(`&createdTimeTo=${createdTimeTo.toISOString()}`)
                .concat("&runtimeStatus=Failed,Terminated"));

            const client = new DurableOrchestrationClient(context);
            const expectedStatuses: DurableOrchestrationStatus[] = [ ];
            this.getStub.resolves(new HttpResponse(202, expectedStatuses));

            const result = await client.getStatusBy(createdTimeFrom, createdTimeTo, runtimeStatuses);
            sinon.assert.calledWithExactly(this.getStub, webhookUrl);
            expect(result).to.be.deep.equal(expectedStatuses);
        });

        it("calls expected webhook with some filters", async () => {
            const context = defaultContext;

            const runtimeStatuses = [ OrchestrationRuntimeStatus.Failed, OrchestrationRuntimeStatus.Terminated ];
            const webhookUrl = new URL(context.bindings.starter.managementUrls.statusQueryGetUri
                .replace(idPlaceholder, "")
                .concat("&runtimeStatus=Failed,Terminated"));

            const client = new DurableOrchestrationClient(context);
            const expectedStatuses: DurableOrchestrationStatus[] = [ ];
            this.getStub.resolves(new HttpResponse(202, expectedStatuses));

            const result = await client.getStatusBy(undefined, undefined, runtimeStatuses);
            sinon.assert.calledWithExactly(this.getStub, webhookUrl);
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
            const context = defaultContext;
            const webhookUrl = new URL(context.bindings.starter.managementUrls.sendEventPostUri
                .replace(idPlaceholder, defaultInstanceId)
                .replace(eventNamePlaceholder, defaultTestEvent));

            const client = new DurableOrchestrationClient(context);
            this.postStub.resolves(new HttpResponse(202, undefined));

            const result = await client.raiseEvent(defaultInstanceId, defaultTestEvent, defaultTestData);
            sinon.assert.calledWithExactly(this.postStub, webhookUrl, defaultTestData);
            expect(result).to.be.equal(undefined);
        });

        it("calls expected webhook when task hub specified", async () => {
            const context = defaultContext;
            const testTaskHub = "SpecialTaskHub";
            const webhookUrl = new URL(context.bindings.starter.managementUrls.sendEventPostUri
                .replace(idPlaceholder, defaultInstanceId)
                .replace(eventNamePlaceholder, defaultTestEvent)
                .replace(defaultTaskHub, testTaskHub));

            const client = new DurableOrchestrationClient(context);
            this.postStub.resolves(new HttpResponse(202, undefined));

            const result = await client.raiseEvent(defaultInstanceId, defaultTestEvent, defaultTestData, testTaskHub);
            sinon.assert.calledWithExactly(this.postStub, webhookUrl, defaultTestData);
            expect(result).to.be.equal(undefined);
        });

        it("calls expected webhook when connection specified", async () => {
            const context = defaultContext;
            const testConnection = "RainbowConnection";
            const webhookUrl = new URL(context.bindings.starter.managementUrls.sendEventPostUri
                .replace(idPlaceholder, defaultInstanceId)
                .replace(eventNamePlaceholder, defaultTestEvent)
                .replace(defaultConnection, testConnection));

            const client = new DurableOrchestrationClient(context);
            this.postStub.resolves(new HttpResponse(202, undefined));

            const result = await client.raiseEvent(
                defaultInstanceId,
                defaultTestEvent,
                defaultTestData,
                undefined,
                testConnection);
            sinon.assert.calledWithExactly(this.postStub, webhookUrl, defaultTestData);
            expect(result).to.be.equal(undefined);
        });

        it("throws when specified instance not found", async () => {
            const context = defaultContext;

            const id = "badId";
            const webhookUrl = new URL(context.bindings.starter.managementUrls.sendEventPostUri
                .replace(idPlaceholder, id)
                .replace(eventNamePlaceholder, defaultTestEvent));

            const client = new DurableOrchestrationClient(context);
            this.postStub.resolves(new HttpResponse(404, undefined));

            await expect (client.raiseEvent(id, defaultTestEvent, defaultTestData))
                .to.be.rejectedWith(`No instance with ID '${id}' found.`);
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
            const context = defaultContext;
            const testReason = "test";

            const webhookUrl = new URL(context.bindings.starter.managementUrls.terminatePostUri
                .replace(idPlaceholder, defaultInstanceId)
                .replace(reasonPlaceholder, testReason));

            const client = new DurableOrchestrationClient(context);
            this.postStub.resolves(new HttpResponse(202, undefined));

            const result = await client.rewind(defaultInstanceId, testReason);
            sinon.assert.calledWithExactly(this.postStub, webhookUrl);
            expect(result).to.be.equal(undefined);
        });

        const invalidCodes = [ 404, 410, 500 ];
        invalidCodes.forEach((statusCode) => {
            it(`throws when webhook returns invalid status code ${statusCode}`, async () => {
                const context = defaultContext;

                const id = "badId";
                const testReason = "test";

                const webhookUrl = new URL(context.bindings.starter.managementUrls.rewindPostUri
                    .replace(idPlaceholder, id)
                    .replace(reasonPlaceholder, testReason));
                const client = new DurableOrchestrationClient(context);
                this.postStub.resolves(new HttpResponse(statusCode, undefined));

                await expect(client.rewind(id, testReason)).to.be.rejectedWith(Error);
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
            const functionName = defaultOrchestrationName;
            const webhookUrl = createInstanceWebhookUrl(notificationUrlHost, functionName);

            const client = new DurableOrchestrationClient(defaultContext);
            this.postStub.resolves(new HttpResponse(202, new HttpManagementPayload(defaultInstanceId, "", "", "", "")));

            const result = await client.startNew(functionName);
            sinon.assert.calledWithExactly(this.postStub, webhookUrl, undefined);
            expect(result).to.equal(defaultInstanceId);
        });

        it("starts new instance with specific id and input", async () => {
            const functionName = defaultOrchestrationName;
            const webhookUrl = createInstanceWebhookUrl(notificationUrlHost, functionName, defaultInstanceId);

            const client = new DurableOrchestrationClient(defaultContext);
            this.postStub.resolves(new HttpResponse(202, new HttpManagementPayload(defaultInstanceId, "", "", "", "")));

            const result = await client.startNew(functionName, defaultInstanceId, { key: "value" });
            sinon.assert.calledWithExactly(this.postStub, webhookUrl, { key: "value" });
            expect(result).to.equal(defaultInstanceId);
        });

        it("throws if webhook client returns error", async () => {
            const functionName = "BadOrchestration";

            const client = new DurableOrchestrationClient(defaultContext);
            this.postStub.resolves(new HttpResponse(500, undefined));

            await expect(client.startNew(functionName)).to.be.rejectedWith(Error);
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
            const context = defaultContext;
            const testReason = "test";

            const webhookUrl = new URL(context.bindings.starter.managementUrls.terminatePostUri
                .replace(idPlaceholder, defaultInstanceId)
                .replace(reasonPlaceholder, testReason));

            const client = new DurableOrchestrationClient(context);
            this.postStub.resolves(new HttpResponse(202, undefined));

            const result = await client.terminate(defaultInstanceId, testReason);
            sinon.assert.calledWithExactly(this.postStub, webhookUrl);
            expect(result).to.be.equal(undefined);
        });

        const invalidCodes = [ 404, 500 ];
        invalidCodes.forEach((statusCode) => {
            it(`throws when webhook returns invalid status code ${statusCode}`, async () => {
                const context = defaultContext;

                const id = "badId";
                const testReason = "test";

                const webhookUrl = new URL(context.bindings.starter.managementUrls.terminatePostUri
                    .replace(idPlaceholder, id)
                    .replace(reasonPlaceholder, testReason));
                const client = new DurableOrchestrationClient(context);
                this.postStub.resolves(new HttpResponse(404, undefined));

                await expect(client.terminate(id, testReason)).to.be.rejectedWith(Error);
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
            const badInterval = 1e6;

            const client = new DurableOrchestrationClient(defaultContext);
            await expect(client.waitForCompletionOrCreateCheckStatusResponse(
                defaultRequest,
                defaultInstanceId,
                defaultTimeout,
                badInterval))
                .to.be.rejectedWith(`Total timeout ${defaultTimeout} (ms) should be bigger than retry timeout ${badInterval} (ms)`); // tslint:disable-line max-line-length
        });

        it("returns expected result for completed instance", async () => {
            const expectedOutput = 42;
            const expectedResponse = new HttpResponse(
                200,
                JSON.stringify(expectedOutput),
                {
                    "Content-Type": "application/json",
                    "Content-Length": 2,
                },
            );

            const client = new DurableOrchestrationClient(defaultContext);
            this.getStub.resolves(
                new HttpResponse(
                    202,
                    new DurableOrchestrationStatus(
                        defaultOrchestrationName,
                        defaultInstanceId,
                        undefined,
                        undefined,
                        undefined,
                        expectedOutput,
                        OrchestrationRuntimeStatus.Completed,
                    ),
                ),
            );
            const res = await client.waitForCompletionOrCreateCheckStatusResponse(
                defaultRequest,
                defaultInstanceId,
                defaultTimeout,
                defaultInterval);
            expect(res).to.be.deep.equal(expectedResponse);
        });

        it("returns expected result for canceled instance", async () => {
            const expectedStatus = new DurableOrchestrationStatus(
                defaultOrchestrationName,
                defaultInstanceId,
                undefined,
                undefined,
                undefined,
                undefined,
                OrchestrationRuntimeStatus.Canceled,
            );
            const expectedStatusAsJson = JSON.stringify(expectedStatus);
            const expectedResponse = new HttpResponse(
                200,
                expectedStatusAsJson,
                {
                    "Content-Type": "application/json",
                    "Content-Length": expectedStatusAsJson.length,
                },
            );

            const client = new DurableOrchestrationClient(defaultContext);
            this.getStub.resolves(
                new HttpResponse(
                    200,
                    expectedStatus,
                ),
            );
            const res = await client.waitForCompletionOrCreateCheckStatusResponse(
                defaultRequest,
                defaultInstanceId,
                defaultTimeout,
                defaultInterval);
            expect(res).to.be.deep.equal(expectedResponse);
        });

        it("returns expected result for terminated instance", async () => {
            const expectedStatus = new DurableOrchestrationStatus(
                defaultOrchestrationName,
                defaultInstanceId,
                undefined,
                undefined,
                undefined,
                undefined,
                OrchestrationRuntimeStatus.Terminated,
            );
            const expectedStatusAsJson = JSON.stringify(expectedStatus);
            const expectedResponse = new HttpResponse(
                200,
                expectedStatusAsJson,
                {
                    "Content-Type": "application/json",
                    "Content-Length": expectedStatusAsJson.length,
                },
            );

            const client = new DurableOrchestrationClient(defaultContext);
            this.getStub.resolves(
                new HttpResponse(
                    200,
                    expectedStatus,
                ),
            );
            const res = await client.waitForCompletionOrCreateCheckStatusResponse(
                defaultRequest,
                defaultInstanceId,
                defaultTimeout,
                defaultInterval);
            expect(res).to.be.deep.equal(expectedResponse);
        });

        it("returns expected result for failed instance", async () => {
            const expectedStatus = new DurableOrchestrationStatus(
                defaultOrchestrationName,
                defaultInstanceId,
                undefined,
                undefined,
                undefined,
                undefined,
                OrchestrationRuntimeStatus.Failed,
            );
            const expectedStatusAsJson = JSON.stringify(expectedStatus);
            const expectedResponse = new HttpResponse(
                500,
                expectedStatusAsJson,
                {
                    "Content-Type": "application/json",
                    "Content-Length": expectedStatusAsJson.length,
                },
            );

            const client = new DurableOrchestrationClient(defaultContext);
            this.getStub.resolves(
                new HttpResponse(
                    200,
                    expectedStatus,
                ),
            );
            const res = await client.waitForCompletionOrCreateCheckStatusResponse(
                defaultRequest,
                defaultInstanceId,
                defaultTimeout,
                defaultInterval);
            expect(res).to.be.deep.equal(expectedResponse);
        });

        it("continues polling for running instance", async () => {
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
            const expectedResponse = new HttpResponse(
                200,
                JSON.stringify(expectedOutput),
                {
                    "Content-Type": "application/json",
                    "Content-Length": 2,
                },
            );

            const client = new DurableOrchestrationClient(defaultContext);
            this.getStub.onFirstCall().resolves(
                new HttpResponse(
                    202,
                    runningStatus,
                    // TODO: some headers should go here for the sake of accuracy
                ),
            );
            this.getStub.onSecondCall().resolves(
                new HttpResponse(
                    200,
                    completedStatus,
                    {
                        "Content-Type": "application/json",
                        "Content-Length": 2,
                    },
                ),
            );

            const res = await client.waitForCompletionOrCreateCheckStatusResponse(
                defaultRequest,
                defaultInstanceId,
                defaultTimeout,
                defaultInterval);
            sinon.assert.calledTwice(this.getStub);
            expect(res).to.be.deep.equal(expectedResponse);
        });

        it("returns check status response if timeout expires", async () => {
            const runningStatus = new DurableOrchestrationStatus(
                defaultOrchestrationName,
                defaultInstanceId,
                undefined,
                undefined,
                undefined,
                undefined,
                OrchestrationRuntimeStatus.Running,
            );

            const client = new DurableOrchestrationClient(defaultContext);
            const expectedResponse = client.createCheckStatusResponse(defaultRequest, defaultInstanceId);
            this.getStub.resolves(
                new HttpResponse(
                    202,
                    runningStatus,
                    // TODO: some headers should go here for the sake of accuracy
                ),
            );

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
    let url = "";
    if (timeoutInSeconds && intervalInSeconds) {
        url = waitOnPostUriTemplate
            .replace(timeoutPlaceholder, timeoutInSeconds.toString())
            .replace(intervalPlaceholder, intervalInSeconds.toString());
    } else {
        url = createPostUriTemplate;
    }

    url = url
        .replace(hostPlaceholder, host)
        .replace(functionPlaceholder, functionName)
        .replace(idPlaceholder, (instanceId ? instanceId : ""));

    return new URL(url);
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
