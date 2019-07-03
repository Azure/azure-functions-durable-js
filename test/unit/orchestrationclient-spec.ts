// tslint:disable:member-access

import { HttpRequest } from "@azure/functions";
import chai = require("chai");
import chaiAsPromised = require("chai-as-promised");
import { isEqual } from "lodash";
import "mocha";
import nock = require("nock");
import url = require("url");
import uuidv1 = require("uuid/v1");
import { Constants, DurableOrchestrationClient, DurableOrchestrationStatus,
    EntityId, EntityStateResponse, HttpManagementPayload,
    OrchestrationRuntimeStatus, PurgeHistoryResult, SchedulerState,
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
        defaultConnection,
    );

    const requiredPostHeaders = { reqheaders: { "Content-Type": "application/json" } };

    describe("Constructor", () => {
        it("throws if clientData is undefined", async () => {
            expect(() => {
                const client = new DurableOrchestrationClient(undefined);
            }).to.throw(`clientData: Expected OrchestrationClientInputData but got undefined`);
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
            const requestObj: HttpRequest = {
                method: "GET",
                url: defaultRequestUrl,
                headers: { },
                query: { },
                params: { },
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
            const client = new DurableOrchestrationClient(defaultClientInputData);
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
            const client = new DurableOrchestrationClient(defaultClientInputData);

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
            const client = new DurableOrchestrationClient(defaultClientInputData);
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
            nock.cleanAll();
        });

        afterEach(async () => {
            nock.cleanAll();
        });

        it("calls expected webhook", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedStatus = new DurableOrchestrationStatus(
                defaultOrchestrationName,
                defaultInstanceId,
                null,
                null,
                null,
                null,
                OrchestrationRuntimeStatus.Pending,
                null,
                null);
            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.statusQueryGetUri
                .replace(TestConstants.idPlaceholder, defaultInstanceId));

            const scope = nock(expectedWebhookUrl.origin)
                .get(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) => urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject))
                .reply(202, expectedStatus);

            const result = await client.getStatus(defaultInstanceId);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.deep.equal(expectedStatus);
        });

        it("calls expected webhook when showHistory = true", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedStatus = new DurableOrchestrationStatus(
                defaultOrchestrationName,
                defaultInstanceId,
                null,
                null,
                null,
                null,
                OrchestrationRuntimeStatus.Pending,
                null,
                null);
            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.statusQueryGetUri
                .replace(TestConstants.idPlaceholder, defaultInstanceId)
                + "&showHistory=true");

            const scope = nock(expectedWebhookUrl.origin)
                .get(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) => urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject))
                .reply(202, expectedStatus);

            const result = await client.getStatus(defaultInstanceId, true);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.deep.equal(expectedStatus);
        });

        it("calls expected webhook when showHistoryOutput = true", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedStatus = new DurableOrchestrationStatus(
                defaultOrchestrationName,
                defaultInstanceId,
                null,
                null,
                null,
                null,
                OrchestrationRuntimeStatus.Pending,
                null,
                null);
            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.statusQueryGetUri
                .replace(TestConstants.idPlaceholder, defaultInstanceId)
                + "&showHistoryOutput=true");

            const scope = nock(expectedWebhookUrl.origin)
                .get(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) => urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject))
                .reply(202, expectedStatus);

            const result = await client.getStatus(defaultInstanceId, false, true);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.deep.equal(expectedStatus);
        });

        it("calls expected webhook when showInput = false", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedStatus = new DurableOrchestrationStatus(
                defaultOrchestrationName,
                defaultInstanceId,
                null,
                null,
                null,
                null,
                OrchestrationRuntimeStatus.Pending,
                null,
                null);
            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.statusQueryGetUri
                .replace(TestConstants.idPlaceholder, defaultInstanceId)
                + "&showInput=false");

            const scope = nock(expectedWebhookUrl.origin)
                .get(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) => urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject))
                .reply(202, expectedStatus);

            const result = await client.getStatus(defaultInstanceId, false, false, false);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.deep.equal(expectedStatus);
        });

        // TODO: test status codes individually
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

            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.statusQueryGetUri
                .replace(TestConstants.idPlaceholder, ""));

            const expectedStatuses: DurableOrchestrationStatus[] = [
                new DurableOrchestrationStatus(
                    defaultOrchestrationName,
                    defaultInstanceId,
                    null,
                    null,
                    null,
                    null,
                    OrchestrationRuntimeStatus.Pending,
                    null,
                    null),
            ];
            const scope = nock(expectedWebhookUrl.origin)
                .get(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) => urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject))
                .reply(202, expectedStatuses);

            const result = await client.getStatusAll();
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.deep.equal(expectedStatuses);
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
            const createdTimeFrom = new Date(createdTimeTo.getTime() - 1000 * 60 * 60 * 24 * 3);    // last three days
            const runtimeStatuses = [ OrchestrationRuntimeStatus.Failed, OrchestrationRuntimeStatus.Terminated ];

            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.statusQueryGetUri
                .replace(TestConstants.idPlaceholder, "")
                .concat(`&createdTimeFrom=${createdTimeFrom.toISOString()}`)
                .concat(`&createdTimeTo=${createdTimeTo.toISOString()}`)
                .concat("&runtimeStatus=Failed,Terminated"));

            const expectedStatuses: DurableOrchestrationStatus[] = [
                new DurableOrchestrationStatus(
                    defaultOrchestrationName,
                    defaultInstanceId,
                    null,
                    null,
                    null,
                    null,
                    OrchestrationRuntimeStatus.Terminated,
                    null,
                    null),
            ];
            const scope = nock(expectedWebhookUrl.origin)
                .get(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) => urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject))
                .reply(202, expectedStatuses);

            const result = await client.getStatusBy(createdTimeFrom, createdTimeTo, runtimeStatuses);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.deep.equal(expectedStatuses);
        });

        it("calls expected webhook with some filters", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const runtimeStatuses = [ OrchestrationRuntimeStatus.Failed, OrchestrationRuntimeStatus.Terminated ];

            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.statusQueryGetUri
                .replace(TestConstants.idPlaceholder, "")
                .concat("&runtimeStatus=Failed,Terminated"));

            const expectedStatuses: DurableOrchestrationStatus[] = [ ];
            const scope = nock(expectedWebhookUrl.origin)
                .get(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) => urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject))
                .reply(202, expectedStatuses);

            const result = await client.getStatusBy(undefined, undefined, runtimeStatuses);
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
            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.statusQueryGetUri
                .replace(TestConstants.idPlaceholder, defaultInstanceId));

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
            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.statusQueryGetUri
                .replace(TestConstants.idPlaceholder, defaultInstanceId));

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

        it("throws if createdTimeFrom is not a valid date", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            await expect(client.purgeInstanceHistoryBy(undefined, undefined, undefined))
                .to.be.rejectedWith("createdTimeFrom must be a valid Date");
        });

        it("calls expected webhook with all filters and returns expected result when instance(s) found", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const createdTimeTo = new Date();
            const createdTimeFrom = new Date(createdTimeTo.getTime() - 1000 * 60 * 60 * 24 * 3);    // last three days
            const runtimeStatuses = [ OrchestrationRuntimeStatus.Failed, OrchestrationRuntimeStatus.Terminated ];

            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.purgeHistoryDeleteUri
                .replace(TestConstants.idPlaceholder, "")
                .concat(`&createdTimeFrom=${createdTimeFrom.toISOString()}`)
                .concat(`&createdTimeTo=${createdTimeTo.toISOString()}`)
                .concat("&runtimeStatus=Failed,Terminated"));

            const expectedResult = new PurgeHistoryResult(3);
            const scope = nock(expectedWebhookUrl.origin)
                .delete(expectedWebhookUrl.pathname)
                .query(() => {
                    return getQueryObjectFromSearchParams(expectedWebhookUrl);
                })
                .reply(200, expectedResult);

            const result = await client.purgeInstanceHistoryBy(createdTimeFrom, createdTimeTo, runtimeStatuses);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.deep.equal(expectedResult);
        });

        it("calls expected webhook with some filters and returns expected result when no instance(s) found", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const createdTimeTo = new Date();
            const createdTimeFrom = new Date(createdTimeTo.getTime() - 1000 * 60 * 60 * 24 * 3);    // last three days
            const runtimeStatuses = [ OrchestrationRuntimeStatus.Failed, OrchestrationRuntimeStatus.Terminated ];

            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.statusQueryGetUri
                .replace(TestConstants.idPlaceholder, "")
                .concat(`&createdTimeFrom=${createdTimeFrom.toISOString()}`)
                .concat("&runtimeStatus=Failed,Terminated"));

            const expectedResult = new PurgeHistoryResult(0);
            const scope = nock(expectedWebhookUrl.origin)
                .delete(expectedWebhookUrl.pathname)
                .query(() => {
                    return getQueryObjectFromSearchParams(expectedWebhookUrl);
                })
                .reply(404);

            const result = await client.purgeInstanceHistoryBy(createdTimeFrom, undefined, runtimeStatuses);
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

            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.sendEventPostUri
                .replace(TestConstants.idPlaceholder, defaultInstanceId)
                .replace(TestConstants.eventNamePlaceholder, defaultTestEvent));

            const scope = nock(expectedWebhookUrl.origin, requiredPostHeaders)
                .post(expectedWebhookUrl.pathname, JSON.stringify(defaultTestData))
                .query((actualQueryObject: object) => urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject))
                .reply(202);

            const result = await client.raiseEvent(defaultInstanceId, defaultTestEvent, defaultTestData);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.equal(undefined);
        });

        it("calls expected webhook when task hub specified", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const testTaskHub = "SpecialTaskHub";
            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.sendEventPostUri
                .replace(TestConstants.idPlaceholder, defaultInstanceId)
                .replace(TestConstants.eventNamePlaceholder, defaultTestEvent)
                .replace(defaultTaskHub, testTaskHub));
            const scope = nock(expectedWebhookUrl.origin, requiredPostHeaders)
                .post(expectedWebhookUrl.pathname, JSON.stringify(defaultTestData))
                .query((actualQueryObject: object) => urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject))
                .reply(202);

            const result = await client.raiseEvent(defaultInstanceId, defaultTestEvent, defaultTestData, testTaskHub);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.equal(undefined);
        });

        it("calls expected webhook when connection specified", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const testConnection = "RainbowConnection";
            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.sendEventPostUri
                .replace(TestConstants.idPlaceholder, defaultInstanceId)
                .replace(TestConstants.eventNamePlaceholder, defaultTestEvent)
                .replace(defaultConnection, testConnection));
            const scope = nock(expectedWebhookUrl.origin, requiredPostHeaders)
                .post(expectedWebhookUrl.pathname, JSON.stringify(defaultTestData))
                .query((actualQueryObject: object) => urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject))
                .reply(202);

            const result = await client.raiseEvent(
                defaultInstanceId,
                defaultTestEvent,
                defaultTestData,
                undefined,
                testConnection);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.equal(undefined);
        });

        it("throws when specified instance not found", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const id = "badId";
            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.sendEventPostUri
                .replace(TestConstants.idPlaceholder, id)
                .replace(TestConstants.eventNamePlaceholder, defaultTestEvent));
            const scope = nock(expectedWebhookUrl.origin, requiredPostHeaders)
                .post(expectedWebhookUrl.pathname, JSON.stringify(defaultTestData))
                .query((actualQueryObject: object) => urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject))
                .reply(404, undefined);

            await expect (client.raiseEvent(id, defaultTestEvent, defaultTestData))
                .to.be.rejectedWith(`No instance with ID '${id}' found.`);
            expect(scope.isDone()).to.be.equal(true);
        });
    });

    describe("readEntityState", () => {
        beforeEach(async () => {    // TODO: move these to the top-level
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
                names: [ "Bob", "Nancy", "Geraldine" ],
            };
            const expectedStateResponse = new EntityStateResponse<TestEntityState>(
                true,
                expectedEntityStateResponse,
            );

            const expectedWebhookUrl = new url.URL(defaultClientInputData.entityUrls.readEntityStateGetUri
                .replace(TestConstants.entityNamePlaceholder, defaultEntityName)
                .replace(TestConstants.entityKeyPlaceholder, defaultEntityKey));

            const scope = nock(expectedWebhookUrl.origin)
                .get(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) => urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject))
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
                names: [ "Bob", "Nancy", "Geraldine" ],
            };
            const expectedStateResponse = new EntityStateResponse<TestEntityState>(
                true,
                expectedEntityStateResponse,
            );

            const expectedWebhookUrl = new url.URL(defaultClientInputData.entityUrls.readEntityStateGetUri
                .replace(TestConstants.entityNamePlaceholder, defaultEntityName)
                .replace(TestConstants.entityKeyPlaceholder, defaultEntityKey)
                .replace(defaultTaskHub, testTaskHub)
                .replace(defaultConnection, testConn));

            const scope = nock(expectedWebhookUrl.origin)
                .get(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) => urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject))
                .reply(200, expectedEntityStateResponse);

            const result = await client.readEntityState<TestEntityState>(defaultEntityId, testTaskHub, testConn);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.deep.equal(expectedStateResponse);
        });

        it("returns default EntityStateResponse when if entity does not exist", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedResponse: EntityStateResponse<unknown> = {
                entityExists: false,
                entityState: undefined,
            };

            const expectedWebhookUrl = new url.URL(defaultClientInputData.entityUrls.readEntityStateGetUri
                .replace(TestConstants.entityNamePlaceholder, defaultEntityName)
                .replace(TestConstants.entityKeyPlaceholder, defaultEntityKey));

            const scope = nock(expectedWebhookUrl.origin)
                .get(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) => urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject))
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
            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.rewindPostUri
                .replace(TestConstants.idPlaceholder, defaultInstanceId)
                .replace(TestConstants.reasonPlaceholder, testReason));
            const scope = nock(expectedWebhookUrl.origin, requiredPostHeaders)
                .post(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) => urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject))
                .reply(202);

            const result = await client.rewind(defaultInstanceId, testReason);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.equal(undefined);
        });

        it(`throws when webhook returns invalid status code 404`, async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const testId = "badId";
            const testReason = "test";
            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.rewindPostUri
                .replace(TestConstants.idPlaceholder, testId)
                .replace(TestConstants.reasonPlaceholder, testReason));
            const scope = nock(expectedWebhookUrl.origin, requiredPostHeaders)
                .post(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) => urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject))
                .reply(404);

            await expect(client.rewind(testId, testReason)).to.be
                .rejectedWith(`No instance with ID '${testId}' found.`);
            expect(scope.isDone()).to.be.equal(true);
        });

        it(`throws when webhook returns invalid status code 410`, async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const testId = "badId";
            const testReason = "test";
            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.rewindPostUri
                .replace(TestConstants.idPlaceholder, testId)
                .replace(TestConstants.reasonPlaceholder, testReason));
            const scope = nock(expectedWebhookUrl.origin, requiredPostHeaders)
                .post(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) => urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject))
                .reply(410);

            await expect(client.rewind(testId, testReason)).to.be
                .rejectedWith("The rewind operation is only supported on failed orchestration instances.");
            expect(scope.isDone()).to.be.equal(true);
        });

        it(`throws when webhook returns invalid status code 500`, async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const testId = "badId";
            const testReason = "test";
            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.rewindPostUri
                .replace(TestConstants.idPlaceholder, testId)
                .replace(TestConstants.reasonPlaceholder, testReason));
            const scope = nock(expectedWebhookUrl.origin, requiredPostHeaders)
                .post(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) => urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject))
                .reply(500);

            await expect(client.rewind(testId, testReason)).to.be
                .rejectedWith(`Webhook returned unrecognized status code 500`);
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

            const expectedWebhookUrl = new url.URL(defaultClientInputData.entityUrls.signalEntityPostUri
                .replace(TestConstants.entityNamePlaceholder, defaultEntityName)
                .replace(TestConstants.entityKeyPlaceholder, defaultEntityKey)
                .replace(TestConstants.operationPlaceholder, defaultEntityOp));

            const scope = nock(expectedWebhookUrl.origin)
                .post(expectedWebhookUrl.pathname, testSignalData)
                .query((actualQueryObject: object) => urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject))
                .reply(202);

            const result = await client.signalEntity(defaultEntityId, defaultEntityOp, testSignalData);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.equal(undefined);
        });

        it("calls expected webhook with specific task hub and connection", async () => {
            const testTaskHub = "EntityHub";
            const testConn = "EntityConnStr";
            const testSignalData = { data: "foo" };

            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedWebhookUrl = new url.URL(defaultClientInputData.entityUrls.signalEntityPostUri
                .replace(TestConstants.entityNamePlaceholder, defaultEntityName)
                .replace(TestConstants.entityKeyPlaceholder, defaultEntityKey)
                .replace(TestConstants.operationPlaceholder, defaultEntityOp)
                .replace(defaultTaskHub, testTaskHub)
                .replace(defaultConnection, testConn));

            const scope = nock(expectedWebhookUrl.origin)
                .post(expectedWebhookUrl.pathname, testSignalData)
                .query((actualQueryObject: object) => urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject))
                .reply(202);

            const result = await client.signalEntity(defaultEntityId, defaultEntityOp, testSignalData, testTaskHub, testConn);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.equal(undefined);
        });

        it("calls expected webhook with empty operation", async () => {
            const testSignalData = { data: "foo" };

            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedWebhookUrl = new url.URL(defaultClientInputData.entityUrls.signalEntityPostUri
                .replace(TestConstants.entityNamePlaceholder, defaultEntityName)
                .replace(TestConstants.entityKeyPlaceholder, defaultEntityKey)
                .replace(TestConstants.operationPlaceholder, ""));

            const scope = nock(expectedWebhookUrl.origin)
                .post(expectedWebhookUrl.pathname, testSignalData)
                .query((actualQueryObject: object) => urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject))
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
            const expectedWebhookUrl = createInstanceWebhookUrl(Constants.DefaultLocalOrigin, functionName);
            const scope = nock(expectedWebhookUrl.origin, requiredPostHeaders)
                .post(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) => urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject))
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
                defaultInstanceId);
            const scope = nock(expectedWebhookUrl.origin, requiredPostHeaders)
                .post(expectedWebhookUrl.pathname, JSON.stringify(testData))
                .query((actualQueryObject: object) => urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject))
                .reply(202, new HttpManagementPayload(defaultInstanceId, "", "", "", "", ""));

            const result = await client.startNew(functionName, defaultInstanceId, testData);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.equal(defaultInstanceId);
        });

        it("throws if webhook client returns error", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const functionName = "BadOrchestration";
            const functionBody = "Something went wrong!";
            const expectedWebhookUrl = createInstanceWebhookUrl(Constants.DefaultLocalOrigin, functionName);
            const scope = nock(expectedWebhookUrl.origin, requiredPostHeaders)
                .post(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) => urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject))
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
            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.terminatePostUri
                .replace(TestConstants.idPlaceholder, defaultInstanceId)
                .replace(TestConstants.reasonPlaceholder, testReason));
            const scope = nock(expectedWebhookUrl.origin, requiredPostHeaders)
                .post(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) => urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject))
                .reply(202);

            const result = await client.terminate(defaultInstanceId, testReason);
            expect(scope.isDone()).to.be.equal(true);
            expect(result).to.be.equal(undefined);
        });

        it(`throws when webhook returns invalid status code 404`, async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const id = "badId";
            const testReason = "test";
            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.terminatePostUri
                .replace(TestConstants.idPlaceholder, id)
                .replace(TestConstants.reasonPlaceholder, testReason));
            const scope = nock(expectedWebhookUrl.origin, requiredPostHeaders)
                .post(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) => urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject))
                .reply(404);

            await expect(client.terminate(id, testReason)).to.be
                .rejectedWith(`No instance with ID '${id}' found.`);
            expect(scope.isDone()).to.be.equal(true);
        });

        it(`throws when webhook returns invalid status code 500`, async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const id = "badId";
            const testReason = "test";
            const expectedWebhookUrl = new url.URL(defaultClientInputData.managementUrls.terminatePostUri
                .replace(TestConstants.idPlaceholder, id)
                .replace(TestConstants.reasonPlaceholder, testReason));
            const scope = nock(expectedWebhookUrl.origin, requiredPostHeaders)
                .post(expectedWebhookUrl.pathname)
                .query((actualQueryObject: object) => urlQueryEqualsQueryObject(expectedWebhookUrl, actualQueryObject))
                .reply(500);

            await expect(client.terminate(id, testReason)).to.be
                .rejectedWith(`Webhook returned unrecognized status code 500`);
            expect(scope.isDone()).to.be.equal(true);
        });
    });

    describe("waitForCompletionOrCreateCheckStatusResponse()", () => {
        const defaultRequest: HttpRequest = {
            url: defaultRequestUrl,
            method: "GET",
            headers: { },
            query: { },
            params: { },
        };
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

            await expect(client.waitForCompletionOrCreateCheckStatusResponse(
                defaultRequest,
                defaultInstanceId,
                defaultTimeout,
                badInterval))
                .to.be.rejectedWith(
                    `Total timeout ${defaultTimeout} (ms) should be bigger than retry timeout ${badInterval} (ms)`);
        });

        it("returns expected result for completed instance", async () => {
            const client = new DurableOrchestrationClient(defaultClientInputData);

            const expectedOutput = 42;
            const expectedStatus = new DurableOrchestrationStatus(
                defaultOrchestrationName,
                defaultInstanceId,
                null,
                null,
                null,
                expectedOutput,
                OrchestrationRuntimeStatus.Completed,
                null,
                null,
            );
            const scope = nock(Constants.DefaultLocalOrigin)
                .get(/.*/)
                .reply(202, expectedStatus);

            const expectedResponse = {
                status: 200,
                body: JSON.stringify(expectedOutput),
                headers: {
                    "Content-Type": "application/json",
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
            const scope = nock(Constants.DefaultLocalOrigin)
                .get(/.*/)
                .reply(200, expectedStatus);

            const expectedStatusAsJson = JSON.stringify(expectedStatus);
            const expectedResponse = {
                status: 200,
                body: expectedStatusAsJson,
                headers: {
                    "Content-Type": "application/json",
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
            const scope = nock(Constants.DefaultLocalOrigin)
                .get(/.*/)
                .reply(200, expectedStatus);

            const expectedStatusAsJson = JSON.stringify(expectedStatus);
            const expectedResponse = {
                status: 200,
                body: expectedStatusAsJson,
                headers: {
                    "Content-Type": "application/json",
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
            const scope = nock(Constants.DefaultLocalOrigin)
                .get(/.*/)
                .reply(200, expectedStatus);

            const expectedStatusAsJson = JSON.stringify(expectedStatus);
            const expectedResponse = {
                status: 500,
                body: expectedStatusAsJson,
                headers: {
                    "Content-Type": "application/json",
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

            const httpManagementPayload = TestUtils.createHttpManagementPayload(
                defaultInstanceId,
                TestConstants.hostPlaceholder,
                defaultTaskHub,
                defaultConnection);
            const scope = nock(Constants.DefaultLocalOrigin)
                .get(/.*/)
                .reply(202, runningStatus, {
                    "Content-Type": "application/json",
                    "Location": httpManagementPayload.statusQueryGetUri,
                    "Retry-After": "10",
                })
                .get(/.*/)
                .reply(200, completedStatus, {
                    "Content-Type": "application/json",
                });

            const expectedResponse = {
                status: 200,
                body: JSON.stringify(expectedOutput),
                headers:                 {
                    "Content-Type": "application/json",
                },
            };

            const res = await client.waitForCompletionOrCreateCheckStatusResponse(
                defaultRequest,
                defaultInstanceId,
                defaultTimeout,
                defaultInterval);
            expect(res).to.be.deep.equal(expectedResponse);
            expect(scope.isDone()).to.be.equal(true);
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

            const httpManagementPayload = TestUtils.createHttpManagementPayload(
                defaultInstanceId,
                TestConstants.hostPlaceholder,
                defaultTaskHub,
                defaultConnection);
            const scope = nock(Constants.DefaultLocalOrigin)
                .persist()
                .get(/.*/)
                .reply(202, runningStatus, {
                    "Content-Type": "application/json",
                    "Location": httpManagementPayload.statusQueryGetUri,
                    "Retry-After": "10",
                });

            const expectedResponse = client.createCheckStatusResponse(defaultRequest, defaultInstanceId);

            const res = await client.waitForCompletionOrCreateCheckStatusResponse(
                defaultRequest,
                defaultInstanceId,
                defaultTimeout,
                defaultInterval);
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

function getQueryObjectFromSearchParams(requestUrl: url.URL): { [key: string]: string } {
    const queryObject: { [key: string]: string } = { };
    requestUrl.searchParams.forEach((value, name) => {
        queryObject[name] = value;
    });
    return queryObject;
}

function haveSameQuery(
    expectedQueryObj: { [key: string]: string },
    actualQueryObj: { [key: string]: string }): boolean {
    for (const prop in expectedQueryObj) {
        if (actualQueryObj[prop] !== expectedQueryObj[prop]) {
            return false;
        }
    }
    return true;
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
