// tslint:disable:member-access

import { HttpRequest } from "@azure/functions";
import chai = require("chai");
import chaiAsPromised = require("chai-as-promised");
import { isEqual } from "lodash";
import "mocha";
import nock = require("nock");
import url = require("url");
import uuidv1 = require("uuid/v1");
import {
    Constants,
    DurableOrchestrationClient,
    DurableOrchestrationStatus,
    EntityId,
    EntityStateResponse,
    HttpManagementPayload,
    OrchestrationRuntimeStatus,
    PurgeHistoryResult,
} from "../../src/classes";
import { TestConstants } from "../testobjects/testconstants";
import { TestUtils } from "../testobjects/testutils";

const expect = chai.expect;
chai.use(chaiAsPromised);

describe("Orchestration Client", () => {
    before(() => {
        if (!nock.isActive()) {
            nock.activate();
        }
    });

    after(() => {
        nock.restore();
    });

    const defaultOrchestrationName = "TestOrchestration";
    const defaultRequestUrl = `${Constants.DefaultLocalOrigin}/orchestrators/${defaultOrchestrationName}`;
    const defaultTaskHub = "TestTaskHub";
    const defaultConnection = "Storage";
    const defaultInstanceId = uuidv1();

    const defaultEntityName = "testEntity";
    const defaultEntityKey = "123";
    const defaultEntityId = new EntityId(defaultEntityName, defaultEntityKey);
    const defaultEntityOp = "get";

    const defaultClientInputData = TestUtils.createOrchestrationClientInputData(
        TestConstants.idPlaceholder,
        Constants.DefaultLocalOrigin,
        defaultTaskHub,
        defaultConnection
    );

    const requiredPostHeaders = { reqheaders: { "Content-Type": "application/json" } };

    describe("Properties", () => {
        it("assigns taskHubName", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);
            expect(client.taskHubName).to.be.equal(defaultClientInputData.taskHubName);
        });
    });

    describe("createCheckStatusResponse()", () => {
        it(`returns a proper response object from request.url`, async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);
            const requestObj: HttpRequest = new HttpRequest({
                method: "GET",
                url: defaultRequestUrl,
                headers: {},
                query: {},
                params: {},
            });

            const response = client.createCheckStatusResponse(requestObj, defaultInstanceId);
            const responseBody = await response.json();

            const expectedPayload = TestUtils.createHttpManagementPayload(
                defaultInstanceId,
                Constants.DefaultLocalOrigin,
                defaultTaskHub,
                defaultConnection
            );

            expect(response.status).to.equal(202);
            expect(responseBody).to.deep.equal(expectedPayload);
            expect(response.headers.get("Content-Type")).to.equal("application/json");
            expect(response.headers.get("Location")).to.equal(expectedPayload.statusQueryGetUri);
            expect(response.headers.get("Retry-After")).to.equal("10");
        });

        it("returns a proper response object when request is undefined", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedPayload = TestUtils.createHttpManagementPayload(
                defaultInstanceId,
                Constants.DefaultLocalOrigin,
                defaultTaskHub,
                defaultConnection
            );

            const response = client.createCheckStatusResponse(undefined, defaultInstanceId);
            const responseBody = await response.json();

            expect(response.status).to.equal(202);
            expect(responseBody).to.deep.equal(expectedPayload);
            expect(response.headers.get("Content-Type")).to.equal("application/json");
            expect(response.headers.get("Location")).to.equal(expectedPayload.statusQueryGetUri);
            expect(response.headers.get("Retry-After")).to.equal("10");
        });
    });

    describe("createHttpManagementPayload()", () => {
        it("returns a proper payload", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);
            const expectedPayload = TestUtils.createHttpManagementPayload(
                defaultInstanceId,
                Constants.DefaultLocalOrigin,
                defaultTaskHub,
                defaultConnection
            );

            const payload = client.createHttpManagementPayload(defaultInstanceId);
            expect(payload).to.be.deep.equal(expectedPayload);
        });
    });

    describe("getStatus()", () => {
        beforeEach(async () => {
            nock.cleanAll();
        });

        afterEach(async () => {
            nock.cleanAll();
        });

        it("calls expected webhook", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedStatus = new DurableOrchestrationStatus({
                name: defaultOrchestrationName,
                instanceId: defaultInstanceId,
                createdTime: new Date(),
                lastUpdatedTime: new Date(),
                input: null,
                output: null,
                runtimeStatus: OrchestrationRuntimeStatus.Pending,
            });
            const expectedWebhookUrl = new url.URL(
                defaultClientInputData.managementUrls.statusQueryGetUri.replace(
                    TestConstants.idPlaceholder,
                    defaultInstanceId
                )
            );

            const scope = nock(expectedWebhookUrl.origin)
                .get(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(202, expectedStatus);

            const result = await client.getStatus(defaultInstanceId);
            expect(scope.isDone()).to.be.equal(true);
            expect(JSON.stringify(result)).to.be.equal(JSON.stringify(expectedStatus));
        });

        it("calls expected webhook when showHistory = true", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedStatus = new DurableOrchestrationStatus({
                name: defaultOrchestrationName,
                instanceId: defaultInstanceId,
                createdTime: new Date(),
                lastUpdatedTime: new Date(),
                input: null,
                output: null,
                runtimeStatus: OrchestrationRuntimeStatus.Pending,
            });
            const expectedWebhookUrl = new url.URL(
                defaultClientInputData.managementUrls.statusQueryGetUri.replace(
                    TestConstants.idPlaceholder,
                    defaultInstanceId
                ) + "&showHistory=true"
            );

            const scope = nock(expectedWebhookUrl.origin)
                .get(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(202, expectedStatus);

            const result = await client.getStatus(defaultInstanceId, {
                showHistory: true,
            });
            expect(scope.isDone()).to.be.equal(true);
            expect(JSON.stringify(result)).to.be.equal(JSON.stringify(expectedStatus));
        });

        it("calls expected webhook when showHistoryOutput = true", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedStatus = new DurableOrchestrationStatus({
                name: defaultOrchestrationName,
                instanceId: defaultInstanceId,
                createdTime: new Date(),
                lastUpdatedTime: new Date(),
                input: null,
                output: null,
                runtimeStatus: OrchestrationRuntimeStatus.Pending,
            });
            const expectedWebhookUrl = new url.URL(
                defaultClientInputData.managementUrls.statusQueryGetUri.replace(
                    TestConstants.idPlaceholder,
                    defaultInstanceId
                ) + "&showHistoryOutput=true"
            );

            const scope = nock(expectedWebhookUrl.origin)
                .get(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(202, expectedStatus);

            const result = await client.getStatus(defaultInstanceId, {
                showHistory: false,
                showHistoryOutput: true,
            });
            expect(scope.isDone()).to.be.equal(true);
            expect(JSON.stringify(result)).to.be.equal(JSON.stringify(expectedStatus));
        });

        it("calls expected webhook when showInput = false", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedStatus = new DurableOrchestrationStatus({
                name: defaultOrchestrationName,
                instanceId: defaultInstanceId,
                createdTime: new Date(),
                lastUpdatedTime: new Date(),
                input: null,
                output: null,
                runtimeStatus: OrchestrationRuntimeStatus.Pending,
            });
            const expectedWebhookUrl = new url.URL(
                defaultClientInputData.managementUrls.statusQueryGetUri.replace(
                    TestConstants.idPlaceholder,
                    defaultInstanceId
                ) + "&showInput=false"
            );

            const scope = nock(expectedWebhookUrl.origin)
                .get(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(202, expectedStatus);

            const result = await client.getStatus(defaultInstanceId, {
                showHistory: false,
                showHistoryOutput: false,
                showInput: false,
            });
            expect(scope.isDone()).to.be.equal(true);
            expect(JSON.stringify(result)).to.be.equal(JSON.stringify(expectedStatus));
        });

        describe("correctly handles 200 responses", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedWebhookUrl = new url.URL(
                defaultClientInputData.managementUrls.statusQueryGetUri.replace(
                    TestConstants.idPlaceholder,
                    defaultInstanceId
                )
            );

            it("correctly handles Completed case", async () => {
                const expectedStatus = new DurableOrchestrationStatus({
                    name: defaultOrchestrationName,
                    instanceId: defaultInstanceId,
                    createdTime: new Date().toString(),
                    lastUpdatedTime: new Date().toString(),
                    input: null,
                    output: "myOutput",
                    runtimeStatus: OrchestrationRuntimeStatus.Completed,
                });

                const scope = nock(expectedWebhookUrl.origin)
                    .get(expectedWebhookUrl.pathname)
                    .query((actualQueryObject: object) =>
                        urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                    )
                    .reply(200, expectedStatus);

                const result = await client.getStatus(defaultInstanceId);
                expect(scope.isDone()).to.be.equal(true);
                expect(JSON.stringify(result)).to.be.equal(JSON.stringify(expectedStatus));
            });

            it("correctly handles Failed case", async () => {
                const expectedStatus = new DurableOrchestrationStatus({
                    name: defaultOrchestrationName,
                    instanceId: defaultInstanceId,
                    createdTime: new Date().toString(),
                    lastUpdatedTime: new Date().toString(),
                    input: null,
                    output: `Orchestrator function '${defaultOrchestrationName}' failed: Error`,
                    runtimeStatus: OrchestrationRuntimeStatus.Failed,
                });

                const scope = nock(expectedWebhookUrl.origin)
                    .get(expectedWebhookUrl.pathname)
                    .query((actualQueryObject: object) =>
                        urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                    )
                    .reply(200, expectedStatus);

                const result = await client.getStatus(defaultInstanceId);
                expect(scope.isDone()).to.be.equal(true);
                expect(JSON.stringify(result)).to.be.equal(JSON.stringify(expectedStatus));
            });

            it("correctly handles Terminated case", async () => {
                const expectedStatus = new DurableOrchestrationStatus({
                    name: defaultOrchestrationName,
                    instanceId: defaultInstanceId,
                    createdTime: new Date().toString(),
                    lastUpdatedTime: new Date().toString(),
                    input: null,
                    output: `Termination reason`,
                    runtimeStatus: OrchestrationRuntimeStatus.Terminated,
                });

                const scope = nock(expectedWebhookUrl.origin)
                    .get(expectedWebhookUrl.pathname)
                    .query((actualQueryObject: object) =>
                        urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                    )
                    .reply(200, expectedStatus);

                const result = await client.getStatus(defaultInstanceId);
                expect(scope.isDone()).to.be.equal(true);
                expect(JSON.stringify(result)).to.be.equal(JSON.stringify(expectedStatus));
            });
        });

        describe("correctly handles 202 responses", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedWebhookUrl = new url.URL(
                defaultClientInputData.managementUrls.statusQueryGetUri.replace(
                    TestConstants.idPlaceholder,
                    defaultInstanceId
                )
            );

            it("correctly handles Pending case", async () => {
                const expectedStatus = new DurableOrchestrationStatus({
                    name: defaultOrchestrationName,
                    instanceId: defaultInstanceId,
                    createdTime: new Date().toString(),
                    lastUpdatedTime: new Date().toString(),
                    input: null,
                    output: null,
                    runtimeStatus: OrchestrationRuntimeStatus.Pending,
                });

                const scope = nock(expectedWebhookUrl.origin)
                    .get(expectedWebhookUrl.pathname)
                    .query((actualQueryObject: object) =>
                        urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                    )
                    .reply(202, expectedStatus);

                const result = await client.getStatus(defaultInstanceId);
                expect(scope.isDone()).to.be.equal(true);
                expect(JSON.stringify(result)).to.be.equal(JSON.stringify(expectedStatus));
            });

            it("correctly handles Running case", async () => {
                const expectedStatus = new DurableOrchestrationStatus({
                    name: defaultOrchestrationName,
                    instanceId: defaultInstanceId,
                    createdTime: new Date().toString(),
                    lastUpdatedTime: new Date().toString(),
                    input: null,
                    output: null,
                    runtimeStatus: OrchestrationRuntimeStatus.Running,
                });

                const scope = nock(expectedWebhookUrl.origin)
                    .get(expectedWebhookUrl.pathname)
                    .query((actualQueryObject: object) =>
                        urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                    )
                    .reply(202, expectedStatus);

                const result = await client.getStatus(defaultInstanceId);
                expect(scope.isDone()).to.be.equal(true);
                expect(JSON.stringify(result)).to.be.equal(JSON.stringify(expectedStatus));
            });
        });

        it("throws on 500 responses", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedWebhookUrl = new url.URL(
                defaultClientInputData.managementUrls.statusQueryGetUri.replace(
                    TestConstants.idPlaceholder,
                    defaultInstanceId
                )
            );

            const exception = {
                Message: "Something went wrong while processing your request",
                ExceptionType:
                    "ExceptionType: 'DurableTask.AzureStorage.Storage.DurableTaskStorageException",
                ExceptionMessage:
                    "No connection could be made because the target machine actively refused it. (127.0.0.1:10002)",
                StackTrace: "Sample stack trace",
            };

            nock(expectedWebhookUrl.origin)
                .get(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(500, exception);

            await expect(client.getStatus(defaultInstanceId)).to.be.rejectedWith(
                `The operation failed with an unexpected status code: 500. Details: ${JSON.stringify(
                    exception
                )}`
            );
        });

        it("Throws on empty response data", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedWebhookUrl = new url.URL(
                defaultClientInputData.managementUrls.statusQueryGetUri.replace(
                    TestConstants.idPlaceholder,
                    defaultInstanceId
                )
            );

            nock(expectedWebhookUrl.origin)
                .get(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(200, "");

            await expect(client.getStatus(defaultInstanceId)).to.be.rejectedWith(
                `DurableClient error: the Durable Functions extension replied with an empty HTTP 200 response.`
            );
        });

        it("throws on malformed response data", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedWebhookUrl = new url.URL(
                defaultClientInputData.managementUrls.statusQueryGetUri.replace(
                    TestConstants.idPlaceholder,
                    defaultInstanceId
                )
            );

            const statusInit = {
                createdTime: new Date().toString(),
                lastUpdatedTime: new Date().toString(),
                input: null,
                output: null,
                runtimeStatus: OrchestrationRuntimeStatus.Running,
            };

            nock(expectedWebhookUrl.origin)
                .get(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(202, statusInit);

            await expect(client.getStatus(defaultInstanceId)).to.be.rejectedWith(
                `DurableClient error: could not construct a DurableOrchestrationStatus object using the data received from the Durable Functions extension: ` +
                    `Failed to construct a DurableOrchestrationStatus object because the initializer had invalid types or missing fields. ` +
                    `Initializer received: ${JSON.stringify(statusInit)}`
            );
        });

        it("throws on invalid instanceId", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedWebhookUrl = new url.URL(
                defaultClientInputData.managementUrls.statusQueryGetUri.replace(
                    TestConstants.idPlaceholder,
                    "nonExistentInstanceId"
                )
            );

            nock(expectedWebhookUrl.origin)
                .get(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(404, "");

            await expect(client.getStatus("nonExistentInstanceId")).to.be.rejectedWith(
                `DurableClient error: Durable Functions extension replied with HTTP 404 response. This usually means we could not find any data associated with the instanceId provided: nonExistentInstanceId.`
            );
        });
    });

    describe("getStatusAll()", () => {
        beforeEach(async () => {
            nock.cleanAll();
        });

        afterEach(async () => {
            nock.cleanAll();
        });

        it("calls expected webhook", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedWebhookUrl = new url.URL(
                defaultClientInputData.managementUrls.statusQueryGetUri.replace(
                    TestConstants.idPlaceholder,
                    ""
                )
            );

            const expectedStatuses: DurableOrchestrationStatus[] = [
                new DurableOrchestrationStatus({
                    name: defaultOrchestrationName,
                    instanceId: defaultInstanceId,
                    createdTime: new Date(),
                    lastUpdatedTime: new Date(),
                    input: null,
                    output: null,
                    runtimeStatus: OrchestrationRuntimeStatus.Pending,
                }),
            ];
            const scope = nock(expectedWebhookUrl.origin)
                .get(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(200, expectedStatuses);

            const result = await client.getStatusAll();
            expect(scope.isDone()).to.be.equal(true);
            expect(JSON.stringify(result)).to.be.equal(JSON.stringify(expectedStatuses));
        });
    });

    describe("getStatusBy()", () => {
        beforeEach(async () => {
            nock.cleanAll();
        });

        afterEach(async () => {
            nock.cleanAll();
        });

        it("calls expected webhook with all filters", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const createdTimeTo = new Date();
            const createdTimeFrom = new Date(createdTimeTo.getTime() - 1000 * 60 * 60 * 24 * 3); // last three days
            const runtimeStatuses = [
                OrchestrationRuntimeStatus.Failed,
                OrchestrationRuntimeStatus.Terminated,
            ];

            const expectedWebhookUrl = new url.URL(
                defaultClientInputData.managementUrls.statusQueryGetUri
                    .replace(TestConstants.idPlaceholder, "")
                    .concat(`&createdTimeFrom=${createdTimeFrom.toISOString()}`)
                    .concat(`&createdTimeTo=${createdTimeTo.toISOString()}`)
                    .concat("&runtimeStatus=Failed,Terminated")
            );

            const expectedStatuses: DurableOrchestrationStatus[] = [
                new DurableOrchestrationStatus({
                    name: defaultOrchestrationName,
                    instanceId: defaultInstanceId,
                    createdTime: new Date(),
                    lastUpdatedTime: new Date(),
                    input: null,
                    output: null,
                    runtimeStatus: OrchestrationRuntimeStatus.Terminated,
                }),
            ];
            const scope = nock(expectedWebhookUrl.origin)
                .get(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(200, expectedStatuses);

            const result = await client.getStatusBy({
                createdTimeFrom,
                createdTimeTo,
                runtimeStatus: runtimeStatuses,
            });
            expect(scope.isDone()).to.be.equal(true);
            expect(JSON.stringify(result)).to.be.equal(JSON.stringify(expectedStatuses));
        });

        it("calls expected webhook with some filters", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const runtimeStatuses = [
                OrchestrationRuntimeStatus.Failed,
                OrchestrationRuntimeStatus.Terminated,
            ];

            const expectedWebhookUrl = new url.URL(
                defaultClientInputData.managementUrls.statusQueryGetUri
                    .replace(TestConstants.idPlaceholder, "")
                    .concat("&runtimeStatus=Failed,Terminated")
            );

            const expectedStatuses: DurableOrchestrationStatus[] = [];
            const scope = nock(expectedWebhookUrl.origin)
                .get(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(200, expectedStatuses);

            const result = await client.getStatusBy({ runtimeStatus: runtimeStatuses });
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.deep.equal(expectedStatuses);
        });
    });

    describe("purgeInstanceHistory()", () => {
        beforeEach(async () => {
            nock.cleanAll();
        });

        afterEach(async () => {
            nock.cleanAll();
        });

        it("calls expected webhook and returns expected result when instance exists", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedResult = new PurgeHistoryResult(1);
            const expectedWebhookUrl = new url.URL(
                defaultClientInputData.managementUrls.statusQueryGetUri.replace(
                    TestConstants.idPlaceholder,
                    defaultInstanceId
                )
            );

            const scope = nock(expectedWebhookUrl.origin)
                .delete(expectedWebhookUrl.pathname)
                .query(() => {
                    return getQueryObjectFromSearchParams(expectedWebhookUrl);
                })
                .reply(200, expectedResult);

            const result = await client.purgeInstanceHistory(defaultInstanceId);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.deep.equal(expectedResult);
        });

        it("calls expected webhook and returns expected result when instance does not exist", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedResult = new PurgeHistoryResult(0);
            const expectedWebhookUrl = new url.URL(
                defaultClientInputData.managementUrls.statusQueryGetUri.replace(
                    TestConstants.idPlaceholder,
                    defaultInstanceId
                )
            );

            const scope = nock(expectedWebhookUrl.origin)
                .delete(expectedWebhookUrl.pathname)
                .query(() => {
                    return getQueryObjectFromSearchParams(expectedWebhookUrl);
                })
                .reply(404);

            const result = await client.purgeInstanceHistory(defaultInstanceId);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.deep.equal(expectedResult);
        });
    });

    describe("purgeInstanceHistoryBy()", () => {
        beforeEach(async () => {
            nock.cleanAll();
        });

        afterEach(async () => {
            nock.cleanAll();
        });

        it("calls expected webhook with all filters and returns expected result when instance(s) found", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const createdTimeTo = new Date();
            const createdTimeFrom = new Date(createdTimeTo.getTime() - 1000 * 60 * 60 * 24 * 3); // last three days
            const runtimeStatuses = [
                OrchestrationRuntimeStatus.Failed,
                OrchestrationRuntimeStatus.Terminated,
            ];

            const expectedWebhookUrl = new url.URL(
                defaultClientInputData.managementUrls.purgeHistoryDeleteUri
                    .replace(TestConstants.idPlaceholder, "")
                    .concat(`&createdTimeFrom=${createdTimeFrom.toISOString()}`)
                    .concat(`&createdTimeTo=${createdTimeTo.toISOString()}`)
                    .concat("&runtimeStatus=Failed,Terminated")
            );

            const expectedResult = new PurgeHistoryResult(3);
            const scope = nock(expectedWebhookUrl.origin)
                .delete(expectedWebhookUrl.pathname)
                .query(() => {
                    return getQueryObjectFromSearchParams(expectedWebhookUrl);
                })
                .reply(200, expectedResult);

            const result = await client.purgeInstanceHistoryBy({
                createdTimeFrom,
                createdTimeTo,
                runtimeStatus: runtimeStatuses,
            });
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.deep.equal(expectedResult);
        });

        it("calls expected webhook with some filters and returns expected result when no instance(s) found", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const createdTimeTo = new Date();
            const createdTimeFrom = new Date(createdTimeTo.getTime() - 1000 * 60 * 60 * 24 * 3); // last three days
            const runtimeStatuses = [
                OrchestrationRuntimeStatus.Failed,
                OrchestrationRuntimeStatus.Terminated,
            ];

            const expectedWebhookUrl = new url.URL(
                defaultClientInputData.managementUrls.statusQueryGetUri
                    .replace(TestConstants.idPlaceholder, "")
                    .concat(`&createdTimeFrom=${createdTimeFrom.toISOString()}`)
                    .concat("&runtimeStatus=Failed,Terminated")
            );

            const expectedResult = new PurgeHistoryResult(0);
            const scope = nock(expectedWebhookUrl.origin)
                .delete(expectedWebhookUrl.pathname)
                .query(() => {
                    return getQueryObjectFromSearchParams(expectedWebhookUrl);
                })
                .reply(404);

            const result = await client.purgeInstanceHistoryBy({
                createdTimeFrom,
                runtimeStatus: runtimeStatuses,
            });
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.deep.equal(expectedResult);
        });
    });

    describe("raiseEvent()", () => {
        const defaultTestEvent = "test";
        const defaultTestData = 42;

        beforeEach(async () => {
            nock.cleanAll();
        });

        afterEach(async () => {
            nock.cleanAll();
        });

        it("calls expected webhook and completes when event request accepted", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedWebhookUrl = new url.URL(
                defaultClientInputData.managementUrls.sendEventPostUri
                    .replace(TestConstants.idPlaceholder, defaultInstanceId)
                    .replace(TestConstants.eventNamePlaceholder, defaultTestEvent)
            );

            const scope = nock(expectedWebhookUrl.origin, requiredPostHeaders)
                .post(expectedWebhookUrl.pathname, JSON.stringify(defaultTestData))
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(202);

            const result = await client.raiseEvent(
                defaultInstanceId,
                defaultTestEvent,
                defaultTestData
            );
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.equal(undefined);
        });

        it("calls expected webhook when task hub specified", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const testTaskHub = "SpecialTaskHub";
            const expectedWebhookUrl = new url.URL(
                defaultClientInputData.managementUrls.sendEventPostUri
                    .replace(TestConstants.idPlaceholder, defaultInstanceId)
                    .replace(TestConstants.eventNamePlaceholder, defaultTestEvent)
                    .replace(defaultTaskHub, testTaskHub)
            );
            const scope = nock(expectedWebhookUrl.origin, requiredPostHeaders)
                .post(expectedWebhookUrl.pathname, JSON.stringify(defaultTestData))
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(202);

            const result = await client.raiseEvent(
                defaultInstanceId,
                defaultTestEvent,
                defaultTestData,
                {
                    taskHubName: testTaskHub,
                }
            );
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.equal(undefined);
        });

        it("calls expected webhook when connection specified", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const testConnection = "RainbowConnection";
            const expectedWebhookUrl = new url.URL(
                defaultClientInputData.managementUrls.sendEventPostUri
                    .replace(TestConstants.idPlaceholder, defaultInstanceId)
                    .replace(TestConstants.eventNamePlaceholder, defaultTestEvent)
                    .replace(defaultConnection, testConnection)
            );
            const scope = nock(expectedWebhookUrl.origin, requiredPostHeaders)
                .post(expectedWebhookUrl.pathname, JSON.stringify(defaultTestData))
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(202);

            const result = await client.raiseEvent(
                defaultInstanceId,
                defaultTestEvent,
                defaultTestData,
                {
                    connectionName: testConnection,
                }
            );
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.equal(undefined);
        });

        it("throws when specified instance not found", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const id = "badId";
            const expectedWebhookUrl = new url.URL(
                defaultClientInputData.managementUrls.sendEventPostUri
                    .replace(TestConstants.idPlaceholder, id)
                    .replace(TestConstants.eventNamePlaceholder, defaultTestEvent)
            );
            const scope = nock(expectedWebhookUrl.origin, requiredPostHeaders)
                .post(expectedWebhookUrl.pathname, JSON.stringify(defaultTestData))
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(404, undefined);

            await expect(
                client.raiseEvent(id, defaultTestEvent, defaultTestData)
            ).to.be.rejectedWith(`No instance with ID '${id}' found.`);
            expect(scope.isDone()).to.be.equal(true);
        });
    });

    describe("readEntityState", () => {
        beforeEach(async () => {
            // TODO: move these to the top-level
            nock.cleanAll();
        });

        afterEach(async () => {
            nock.cleanAll();
        });

        it("calls expected webhook", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedEntityStateResponse: TestEntityState = {
                count: 30,
                isTrue: true,
                names: ["Bob", "Nancy", "Geraldine"],
            };
            const expectedStateResponse = new EntityStateResponse<TestEntityState>(
                true,
                expectedEntityStateResponse
            );

            const expectedWebhookUrl = new url.URL(
                `${defaultClientInputData.baseUrl}/entities/${defaultEntityName}/${defaultEntityKey}?${TestConstants.testCode}`
            );

            const scope = nock(expectedWebhookUrl.origin)
                .get(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(200, expectedEntityStateResponse);

            const result = await client.readEntityState<TestEntityState>(defaultEntityId);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.deep.equal(expectedStateResponse);
        });

        it("calls expected webhook with specific task hub and connection", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const testTaskHub = "EntityHub";
            const testConn = "EntityConnStr";

            const expectedEntityStateResponse: TestEntityState = {
                count: 30,
                isTrue: true,
                names: ["Bob", "Nancy", "Geraldine"],
            };
            const expectedStateResponse = new EntityStateResponse<TestEntityState>(
                true,
                expectedEntityStateResponse
            );

            const expectedWebhookUrl = new url.URL(
                `${defaultClientInputData.baseUrl}/entities/${defaultEntityName}/${defaultEntityKey}?taskHub=${testTaskHub}&connection=${testConn}&${TestConstants.testCode}`
            );

            const scope = nock(expectedWebhookUrl.origin)
                .get(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(200, expectedEntityStateResponse);

            const result = await client.readEntityState<TestEntityState>(defaultEntityId, {
                taskHubName: testTaskHub,
                connectionName: testConn,
            });
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.deep.equal(expectedStateResponse);
        });

        it("returns default EntityStateResponse when if entity does not exist", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedResponse: EntityStateResponse<unknown> = {
                entityExists: false,
                entityState: undefined,
            };

            const expectedWebhookUrl = new url.URL(
                `${defaultClientInputData.baseUrl}/entities/${defaultEntityName}/${defaultEntityKey}?${TestConstants.testCode}`
            );

            const scope = nock(expectedWebhookUrl.origin)
                .get(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(404);

            const result = await client.readEntityState<TestEntityState>(defaultEntityId);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.be.deep.equal(expectedResponse);
        });
    });

    describe("rewind()", () => {
        beforeEach(async () => {
            nock.cleanAll();
        });

        afterEach(async () => {
            nock.cleanAll();
        });

        it("calls expected webhook and completes for valid instance", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const testReason = "test";
            const expectedWebhookUrl = new url.URL(
                defaultClientInputData.managementUrls.rewindPostUri
                    .replace(TestConstants.idPlaceholder, defaultInstanceId)
                    .replace(TestConstants.reasonPlaceholder, testReason)
            );
            const scope = nock(expectedWebhookUrl.origin, requiredPostHeaders)
                .post(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(202);

            const result = await client.rewind(defaultInstanceId, testReason);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.equal(undefined);
        });

        it(`throws when webhook returns invalid status code 404`, async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const testId = "badId";
            const testReason = "test";
            const expectedWebhookUrl = new url.URL(
                defaultClientInputData.managementUrls.rewindPostUri
                    .replace(TestConstants.idPlaceholder, testId)
                    .replace(TestConstants.reasonPlaceholder, testReason)
            );
            const scope = nock(expectedWebhookUrl.origin, requiredPostHeaders)
                .post(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(404);

            await expect(client.rewind(testId, testReason)).to.be.rejectedWith(
                `No instance with ID '${testId}' found.`
            );
            expect(scope.isDone()).to.be.equal(true);
        });

        it(`throws when webhook returns invalid status code 410`, async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const testId = "badId";
            const testReason = "test";
            const expectedWebhookUrl = new url.URL(
                defaultClientInputData.managementUrls.rewindPostUri
                    .replace(TestConstants.idPlaceholder, testId)
                    .replace(TestConstants.reasonPlaceholder, testReason)
            );
            const scope = nock(expectedWebhookUrl.origin, requiredPostHeaders)
                .post(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(410);

            await expect(client.rewind(testId, testReason)).to.be.rejectedWith(
                "The rewind operation is only supported on failed orchestration instances."
            );
            expect(scope.isDone()).to.be.equal(true);
        });

        it(`throws when webhook returns invalid status code 500`, async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const testId = "badId";
            const testReason = "test";
            const expectedWebhookUrl = new url.URL(
                defaultClientInputData.managementUrls.rewindPostUri
                    .replace(TestConstants.idPlaceholder, testId)
                    .replace(TestConstants.reasonPlaceholder, testReason)
            );
            const scope = nock(expectedWebhookUrl.origin, requiredPostHeaders)
                .post(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(500, { error: "Something blew up!" });

            await expect(client.rewind(testId, testReason)).to.be.rejectedWith(
                `The operation failed with an unexpected status code: 500. Details: {"error":"Something blew up!"}`
            );
            expect(scope.isDone()).to.be.equal(true);
        });
    });

    describe("signalEntity()", () => {
        beforeEach(async () => {
            nock.cleanAll();
        });

        afterEach(async () => {
            nock.cleanAll();
        });

        it("calls expected webhook", async () => {
            const testSignalData = { data: "foo" };

            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedWebhookUrl = new url.URL(
                `${defaultClientInputData.baseUrl}/entities/${defaultEntityName}/${defaultEntityKey}?op=${defaultEntityOp}&${TestConstants.testCode}`
            );

            const scope = nock(expectedWebhookUrl.origin)
                .post(expectedWebhookUrl.pathname, testSignalData)
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(202);

            const result = await client.signalEntity(
                defaultEntityId,
                defaultEntityOp,
                testSignalData
            );
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.equal(undefined);
        });

        it("calls expected webhook with specific task hub and connection", async () => {
            const testTaskHub = "EntityHub";
            const testConn = "EntityConnStr";
            const testSignalData = { data: "foo" };

            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedWebhookUrl = new url.URL(
                `${defaultClientInputData.baseUrl}/entities/${defaultEntityName}/${defaultEntityKey}?op=${defaultEntityOp}&taskHub=${testTaskHub}&connection=${testConn}&${TestConstants.testCode}`
            );

            const scope = nock(expectedWebhookUrl.origin)
                .post(expectedWebhookUrl.pathname, testSignalData)
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(202);

            const result = await client.signalEntity(
                defaultEntityId,
                defaultEntityOp,
                testSignalData,
                {
                    taskHubName: testTaskHub,
                    connectionName: testConn,
                }
            );
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.equal(undefined);
        });

        it("calls expected webhook with empty operation", async () => {
            const testSignalData = { data: "foo" };

            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedWebhookUrl = new url.URL(
                `${defaultClientInputData.baseUrl}/entities/${defaultEntityName}/${defaultEntityKey}?${TestConstants.testCode}`
            );

            const scope = nock(expectedWebhookUrl.origin)
                .post(expectedWebhookUrl.pathname, testSignalData)
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(202);

            const result = await client.signalEntity(defaultEntityId, undefined, testSignalData);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.equal(undefined);
        });

        // TODO: JS guards - throw if not string or undefined
    });

    describe("startNew()", () => {
        beforeEach(async () => {
            nock.cleanAll();
        });

        afterEach(async () => {
            nock.cleanAll();
        });

        it("starts new instance with random id and no input", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const functionName = defaultOrchestrationName;
            const expectedWebhookUrl = createInstanceWebhookUrl(
                Constants.DefaultLocalOrigin,
                functionName
            );
            const scope = nock(expectedWebhookUrl.origin, requiredPostHeaders)
                .post(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(202, new HttpManagementPayload(defaultInstanceId, "", "", "", "", ""));

            const result = await client.startNew(functionName);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.equal(defaultInstanceId);
        });

        it("starts new instance with specific id and input", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const functionName = defaultOrchestrationName;
            const testData = { key: "value" };

            const expectedWebhookUrl = createInstanceWebhookUrl(
                Constants.DefaultLocalOrigin,
                functionName,
                defaultInstanceId
            );
            const scope = nock(expectedWebhookUrl.origin, requiredPostHeaders)
                .post(expectedWebhookUrl.pathname, JSON.stringify(testData))
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(202, new HttpManagementPayload(defaultInstanceId, "", "", "", "", ""));

            const result = await client.startNew(functionName, {
                instanceId: defaultInstanceId,
                input: testData,
            });
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.equal(defaultInstanceId);
        });

        it("throws if webhook client returns error", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const functionName = "BadOrchestration";
            const functionBody = "Something went wrong!";
            const expectedWebhookUrl = createInstanceWebhookUrl(
                Constants.DefaultLocalOrigin,
                functionName
            );
            const scope = nock(expectedWebhookUrl.origin, requiredPostHeaders)
                .post(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(500, functionBody);

            await expect(client.startNew(functionName)).to.be.rejectedWith(functionBody);
            expect(scope.isDone()).to.be.equal(true);
        });
    });

    describe("terminate()", () => {
        beforeEach(async () => {
            nock.cleanAll();
        });

        afterEach(async () => {
            nock.cleanAll();
        });

        it("calls expected webhook and completes for valid instance", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const testReason = "test";
            const expectedWebhookUrl = new url.URL(
                defaultClientInputData.managementUrls.terminatePostUri
                    .replace(TestConstants.idPlaceholder, defaultInstanceId)
                    .replace(TestConstants.reasonPlaceholder, testReason)
            );
            const scope = nock(expectedWebhookUrl.origin, requiredPostHeaders)
                .post(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(202);

            const result = await client.terminate(defaultInstanceId, testReason);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.equal(undefined);
        });

        it(`throws when webhook returns invalid status code 404`, async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const id = "badId";
            const testReason = "test";
            const expectedWebhookUrl = new url.URL(
                defaultClientInputData.managementUrls.terminatePostUri
                    .replace(TestConstants.idPlaceholder, id)
                    .replace(TestConstants.reasonPlaceholder, testReason)
            );
            const scope = nock(expectedWebhookUrl.origin, requiredPostHeaders)
                .post(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(404);

            await expect(client.terminate(id, testReason)).to.be.rejectedWith(
                `No instance with ID '${id}' found.`
            );
            expect(scope.isDone()).to.be.equal(true);
        });

        it(`throws when webhook returns invalid status code 500`, async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const id = "badId";
            const testReason = "test";
            const expectedWebhookUrl = new url.URL(
                defaultClientInputData.managementUrls.terminatePostUri
                    .replace(TestConstants.idPlaceholder, id)
                    .replace(TestConstants.reasonPlaceholder, testReason)
            );
            const scope = nock(expectedWebhookUrl.origin, requiredPostHeaders)
                .post(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) =>
                    urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject)
                )
                .reply(500, "Kah-BOOOM!!");

            await expect(client.terminate(id, testReason)).to.be.rejectedWith(
                `The operation failed with an unexpected status code: 500. Details: "Kah-BOOOM!!"`
            );
            expect(scope.isDone()).to.be.equal(true);
        });
    });

    describe("waitForCompletionOrCreateCheckStatusResponse()", () => {
        const defaultRequest: HttpRequest = new HttpRequest({
            url: defaultRequestUrl,
            method: "GET",
            headers: {},
            query: {},
            params: {},
        });
        const defaultTimeout = 50;
        const defaultInterval = 10;

        beforeEach(async () => {
            nock.cleanAll();
        });

        afterEach(async () => {
            nock.cleanAll();
        });

        it("throws when retryIntervalInMilliseconds > timeoutInMilliseconds", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const badInterval = 1e6;

            await expect(
                client.waitForCompletionOrCreateCheckStatusResponse(
                    defaultRequest,
                    defaultInstanceId,
                    {
                        timeoutInMilliseconds: defaultTimeout,
                        retryIntervalInMilliseconds: badInterval,
                    }
                )
            ).to.be.rejectedWith(
                `Total timeout ${defaultTimeout} (ms) should be bigger than retry timeout ${badInterval} (ms)`
            );
        });

        it("returns expected result for completed instance", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedOutput = 42;

            const expectedStatus = new DurableOrchestrationStatus({
                name: defaultOrchestrationName,
                instanceId: defaultInstanceId,
                createdTime: new Date(),
                lastUpdatedTime: new Date(),
                input: null,
                output: expectedOutput,
                runtimeStatus: OrchestrationRuntimeStatus.Completed,
            });

            nock(Constants.DefaultLocalOrigin).get(/.*/).reply(200, expectedStatus);

            const res = await client.waitForCompletionOrCreateCheckStatusResponse(
                defaultRequest,
                defaultInstanceId,
                {
                    timeoutInMilliseconds: defaultTimeout,
                    retryIntervalInMilliseconds: defaultInterval,
                }
            );

            const body = await res.text();
            expect(res.status).to.equal(200);
            expect(body).to.equal(JSON.stringify(expectedOutput));
            expect(res.headers.get("Content-Type")).to.equal("application/json");
        });

        it("returns expected result for canceled instance", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedStatus = new DurableOrchestrationStatus({
                name: defaultOrchestrationName,
                instanceId: defaultInstanceId,
                createdTime: new Date(),
                lastUpdatedTime: new Date(),
                input: null,
                output: null,
                runtimeStatus: OrchestrationRuntimeStatus.Canceled,
            });

            nock(Constants.DefaultLocalOrigin).get(/.*/).reply(202, expectedStatus);

            const expectedStatusAsJson = JSON.stringify(expectedStatus);

            const res = await client.waitForCompletionOrCreateCheckStatusResponse(
                defaultRequest,
                defaultInstanceId,
                {
                    timeoutInMilliseconds: defaultTimeout,
                    retryIntervalInMilliseconds: defaultInterval,
                }
            );

            const body = await res.text();
            expect(res.status).to.equal(200);
            expect(body).to.equal(expectedStatusAsJson);
            expect(res.headers.get("Content-Type")).to.equal("application/json");
        });

        it("returns expected result for terminated instance", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedStatus = new DurableOrchestrationStatus({
                name: defaultOrchestrationName,
                instanceId: defaultInstanceId,
                createdTime: new Date(),
                lastUpdatedTime: new Date(),
                input: null,
                output: null,
                runtimeStatus: OrchestrationRuntimeStatus.Terminated,
            });

            nock(Constants.DefaultLocalOrigin).get(/.*/).reply(200, expectedStatus);

            const expectedStatusAsJson = JSON.stringify(expectedStatus);

            const res = await client.waitForCompletionOrCreateCheckStatusResponse(
                defaultRequest,
                defaultInstanceId,
                {
                    timeoutInMilliseconds: defaultTimeout,
                    retryIntervalInMilliseconds: defaultInterval,
                }
            );

            const body = await res.text();
            expect(res.status).to.equal(200);
            expect(body).to.equal(expectedStatusAsJson);
            expect(res.headers.get("Content-Type")).to.equal("application/json");
        });

        it("returns expected result for failed instance", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedStatus = new DurableOrchestrationStatus({
                name: defaultOrchestrationName,
                instanceId: defaultInstanceId,
                createdTime: new Date(),
                lastUpdatedTime: new Date(),
                input: null,
                output: null,
                runtimeStatus: OrchestrationRuntimeStatus.Failed,
            });

            nock(Constants.DefaultLocalOrigin).get(/.*/).reply(200, expectedStatus);

            const expectedStatusAsJson = JSON.stringify(expectedStatus);

            const res = await client.waitForCompletionOrCreateCheckStatusResponse(
                defaultRequest,
                defaultInstanceId,
                {
                    timeoutInMilliseconds: defaultTimeout,
                    retryIntervalInMilliseconds: defaultInterval,
                }
            );

            const body = await res.text();
            expect(res.status).to.equal(500);
            expect(body).to.equal(expectedStatusAsJson);
            expect(res.headers.get("Content-Type")).to.equal("application/json");
        });

        it("continues polling for running instance", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedOutput = 42;

            const runningStatus = new DurableOrchestrationStatus({
                name: defaultOrchestrationName,
                instanceId: defaultInstanceId,
                createdTime: new Date(),
                lastUpdatedTime: new Date(),
                input: null,
                output: null,
                runtimeStatus: OrchestrationRuntimeStatus.Running,
            });
            const completedStatus = new DurableOrchestrationStatus({
                name: defaultOrchestrationName,
                instanceId: defaultInstanceId,
                createdTime: new Date(),
                lastUpdatedTime: new Date(),
                input: null,
                output: expectedOutput,
                runtimeStatus: OrchestrationRuntimeStatus.Completed,
            });

            const httpManagementPayload = TestUtils.createHttpManagementPayload(
                defaultInstanceId,
                TestConstants.hostPlaceholder,
                defaultTaskHub,
                defaultConnection
            );
            const scope = nock(Constants.DefaultLocalOrigin)
                .get(/.*/)
                .reply(202, runningStatus, {
                    "Content-Type": "application/json",
                    Location: httpManagementPayload.statusQueryGetUri,
                    "Retry-After": "10",
                })
                .get(/.*/)
                .reply(200, completedStatus, {
                    "Content-Type": "application/json",
                });

            const res = await client.waitForCompletionOrCreateCheckStatusResponse(
                defaultRequest,
                defaultInstanceId,
                {
                    timeoutInMilliseconds: defaultTimeout,
                    retryIntervalInMilliseconds: defaultInterval,
                }
            );

            const body = await res.text();
            expect(res.status).to.equal(200);
            expect(body).to.equal(JSON.stringify(expectedOutput));
            expect(res.headers.get("Content-Type")).to.equal("application/json");
            expect(scope.isDone()).to.be.equal(true);
        });

        it("returns check status response if timeout expires", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const runningStatus = new DurableOrchestrationStatus({
                name: defaultOrchestrationName,
                instanceId: defaultInstanceId,
                createdTime: new Date(),
                lastUpdatedTime: new Date(),
                input: null,
                output: null,
                runtimeStatus: OrchestrationRuntimeStatus.Running,
            });

            const httpManagementPayload = TestUtils.createHttpManagementPayload(
                defaultInstanceId,
                TestConstants.hostPlaceholder,
                defaultTaskHub,
                defaultConnection
            );
            const scope = nock(Constants.DefaultLocalOrigin)
                .persist()
                .get(/.*/)
                .reply(202, runningStatus, {
                    "Content-Type": "application/json",
                    Location: httpManagementPayload.statusQueryGetUri,
                    "Retry-After": "10",
                });

            const expectedResponse = client.createCheckStatusResponse(
                defaultRequest,
                defaultInstanceId
            );

            const res = await client.waitForCompletionOrCreateCheckStatusResponse(
                defaultRequest,
                defaultInstanceId,
                {
                    timeoutInMilliseconds: defaultTimeout,
                    retryIntervalInMilliseconds: defaultInterval,
                }
            );
            expect(res).to.be.deep.equal(expectedResponse);

            scope.persist(false);
        });
    });
});

function createInstanceWebhookUrl(
    host: string,
    functionName: string,
    instanceId?: string,
    timeoutInSeconds?: number,
    intervalInSeconds?: number
): url.URL {
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
        .replace(TestConstants.idPlaceholder, instanceId ? `/${instanceId}` : "");

    return new url.URL(webhookUrl);
}

function getQueryObjectFromSearchParams(requestUrl: url.URL): { [key: string]: string } {
    const queryObject: { [key: string]: string } = {};
    requestUrl.searchParams.forEach((value, name) => {
        queryObject[name] = value;
    });
    return queryObject;
}

function urlQueryEqualsQueryObject(requestUrl: url.URL, queryObj: object): boolean {
    const expectedQueryObject = getQueryObjectFromSearchParams(requestUrl);
    const retVal = isEqual(expectedQueryObject, queryObj);
    return retVal;
}

class TestEntityState {
    count: number;
    isTrue: boolean;
    names: string[];
}
