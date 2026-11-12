import http = require("http");
import chai = require("chai");
import chaiAsPromised = require("chai-as-promised");
import nock = require("nock");
import sinon = require("sinon");
import { DurableClient } from "../../src/durableClient/DurableClient";
import { TestConstants } from "../testobjects/testconstants";
import { TestUtils } from "../testobjects/testutils";

chai.use(chaiAsPromised);
const expect = chai.expect;
const origin = "http://127.0.0.1:19071";
const taskHub = "UrlTestHub";
const connection = "UrlTestStorage";
const legacyPath = "/runtime/webhooks/durabletask";

interface InstanceOperation {
    name: string;
    method: "get" | "post" | "delete";
    path: (encodedId: string) => string;
    status: number;
    invoke: (client: DurableClient, instanceId: string) => Promise<unknown>;
}

const operations: InstanceOperation[] = [
    {
        name: "startNew",
        method: "post",
        path: (id) => `/orchestrators/Allowed/${id}`,
        status: 202,
        invoke: (client, id) => client.startNew("Allowed", { instanceId: id }),
    },
    {
        name: "getStatus",
        method: "get",
        path: (id) => `/instances/${id}`,
        status: 200,
        invoke: (client, id) => client.getStatus(id),
    },
    {
        name: "purgeInstanceHistory",
        method: "delete",
        path: (id) => `/instances/${id}`,
        status: 200,
        invoke: (client, id) => client.purgeInstanceHistory(id),
    },
    {
        name: "raiseEvent",
        method: "post",
        path: (id) => `/instances/${id}/raiseEvent/TestEvent`,
        status: 202,
        invoke: (client, id) => client.raiseEvent(id, "TestEvent", { value: 1 }),
    },
    ...(["rewind", "terminate", "suspend", "resume"] as const).map(
        (name): InstanceOperation => ({
            name,
            method: "post",
            path: (id) => `/instances/${id}/${name}`,
            status: 202,
            invoke: (client, id) => client[name](id, "test reason"),
        })
    ),
    {
        name: "restart",
        method: "post",
        path: (id) => `/instances/${id}/restart`,
        status: 202,
        invoke: (client, id) => client.restart(id),
    },
];

function createClient(rpc: boolean): DurableClient {
    const data = TestUtils.createOrchestrationClientInputData(
        "INSTANCEID",
        origin,
        taskHub,
        connection
    );
    data.managementUrls = {
        ...data.managementUrls,
        restartPostUri: `${origin}${legacyPath}/instances/INSTANCEID/restart?taskHub=${taskHub}&connection=${connection}&${TestConstants.testCode}`,
    };
    data.rpcBaseUrl = rpc ? `${origin}/durabletask/` : undefined;
    return new DurableClient(data);
}

describe("Client URL identifiers", () => {
    let requestSpy: sinon.SinonSpy;

    before(() => {
        if (!nock.isActive()) {
            nock.activate();
        }
        nock.disableNetConnect();
    });

    beforeEach(() => {
        requestSpy = sinon.spy(http, "request");
    });

    afterEach(() => {
        requestSpy.restore();
        nock.cleanAll();
    });

    after(() => {
        nock.enableNetConnect();
        nock.restore();
    });

    for (const rpc of [true, false]) {
        describe(rpc ? "RPC" : "legacy", () => {
            const basePath = rpc ? "/durabletask" : legacyPath;
            const invalidIds = [
                ".",
                "..",
                "../Other/instance",
                "%2e%2e/Other/instance",
                "..\\Other\\instance",
                "instance/child",
                "instance?taskHub=Other",
                "instance#fragment",
                "instance\u0000",
                "instance\u001f",
                "instance\u007f",
                "instance\u0085",
            ];
            const validIds = [
                ["normal-123", "normal-123"],
                ["...dots..", "...dots.."],
                ["space id", "space%252520id"],
                ["plus+percent%", "plus%25252Bpercent%252525"],
                ["$&$`$'", "%252524%252526%252524%252560%252524'"],
                ["caf\u00e9", "caf%2525C3%2525A9"],
                ["%2e%2e", "%2525252e%2525252e"],
                ["%2E%2e", "%2525252E%2525252e"],
                ["%252e%252e", "%252525252e%252525252e"],
                ["..%2fother", "..%2525252fother"],
                ["%2F%5C%3F%23", "%2525252F%2525255C%2525253F%25252523"],
                ["%2e%2e%2fOther%2fid", "%2525252e%2525252e%2525252fOther%2525252fid"],
                ["%zz", "%252525zz"],
            ];

            for (const operation of operations) {
                for (const id of invalidIds) {
                    it(`${operation.name} rejects ${JSON.stringify(id)} before HTTP`, async () => {
                        await expect(operation.invoke(createClient(rpc), id)).to.be.rejectedWith(
                            /instanceId must/
                        );
                        expect(requestSpy.called).to.equal(false);
                    });
                }

                if (operation.name !== "startNew") {
                    it(`${operation.name} rejects an empty ID before HTTP`, async () => {
                        await expect(operation.invoke(createClient(rpc), "")).to.be.rejectedWith(
                            /instanceId must/
                        );
                        expect(requestSpy.called).to.equal(false);
                    });
                }

                for (const [id, encodedId] of validIds) {
                    it(`${operation.name} preserves ${JSON.stringify(
                        id
                    )} as one segment`, async () => {
                        const scope = nock(origin)
                            [operation.method](`${basePath}${operation.path(encodedId)}`)
                            .query(true)
                            .reply(operation.status, {
                                id,
                                instanceId: id,
                                name: "Allowed",
                                runtimeStatus: "Running",
                                input: null,
                                output: null,
                                createdTime: "2026-01-01T00:00:00Z",
                                lastUpdatedTime: "2026-01-01T00:00:00Z",
                                instancesDeleted: 1,
                            });

                        await operation.invoke(createClient(rpc), id);

                        expect(scope.isDone()).to.equal(true);
                    });
                }
            }

            for (const id of invalidIds) {
                it(`rejects management links for ${JSON.stringify(id)}`, () => {
                    expect(() => createClient(rpc).createHttpManagementPayload(id)).to.throw(
                        /instanceId must/
                    );
                    expect(() =>
                        createClient(rpc).createCheckStatusResponse(undefined, id)
                    ).to.throw(/instanceId must/);
                });

                it(`rejects a restart target of ${JSON.stringify(id)} before HTTP`, async () => {
                    await expect(
                        createClient(rpc).restart("source", { newInstanceId: id })
                    ).to.be.rejectedWith(/newInstanceId must/);
                    expect(requestSpy.called).to.equal(false);
                });
            }

            for (const [id, encodedId] of validIds) {
                it(`preserves the raw payload ID ${JSON.stringify(
                    id
                )} and encodes its links`, () => {
                    const payload = createClient(rpc).createHttpManagementPayload(id);
                    expect(payload.id).to.equal(id);
                    for (const key of Object.keys(payload).filter((key) => key !== "id")) {
                        const link = new URL(payload[key]);
                        expect(link.origin).to.equal(origin);
                        expect(link.pathname).to.contain(`/instances/${encodedId}`);
                        expect(link.searchParams.get("taskHub")).to.equal(taskHub);
                        expect(link.searchParams.get("connection")).to.equal(connection);
                        expect(link.searchParams.get("code")).to.equal("base64string");
                    }
                });
            }

            for (const id of [undefined, ""]) {
                it(`preserves automatic IDs for startNew with ${JSON.stringify(id)}`, async () => {
                    const scope = nock(origin)
                        .post(`${basePath}/orchestrators/Allowed`)
                        .query(true)
                        .reply(202, { id: "generated" });

                    expect(
                        await createClient(rpc).startNew("Allowed", { instanceId: id })
                    ).to.equal("generated");
                    expect(scope.isDone()).to.equal(true);
                });
            }

            it("rejects malformed Unicode before HTTP", async () => {
                await expect(
                    createClient(rpc).startNew("Allowed", { instanceId: "\ud800" })
                ).to.be.rejectedWith(URIError);
                expect(requestSpy.called).to.equal(false);
            });

            for (const name of [".", "..", "../Other/instance", "name?query", "name#fragment"]) {
                it(`rejects the function path segment ${JSON.stringify(
                    name
                )} before HTTP`, async () => {
                    await expect(createClient(rpc).startNew(name)).to.be.rejectedWith(
                        /orchestratorFunctionName must/
                    );
                    expect(requestSpy.called).to.equal(false);
                });

                it(`rejects the event path segment ${JSON.stringify(
                    name
                )} before HTTP`, async () => {
                    await expect(
                        createClient(rpc).raiseEvent("normal", name, null)
                    ).to.be.rejectedWith(/eventName must/);
                    expect(requestSpy.called).to.equal(false);
                });
            }

            it("encodes an event name without interpreting replacement strings", async () => {
                const scope = nock(origin)
                    .post(
                        `${basePath}/instances/normal/raiseEvent/event%25252B%252525%252524%252526`
                    )
                    .query(true)
                    .reply(202);

                await createClient(rpc).raiseEvent("normal", "event+%$&", null);

                expect(scope.isDone()).to.equal(true);
            });

            it("encodes hub and connection selectors without changing the event route", async () => {
                const taskHubName = "Hub+&connection=Other#fragment";
                const connectionName = "Storage+&taskHub=Other#fragment";
                const scope = nock(origin)
                    .post(`${basePath}/instances/${taskHub}/raiseEvent/TestEvent`)
                    .query({
                        taskHub: taskHubName,
                        connection: connectionName,
                        ...(rpc ? {} : { code: "base64string" }),
                    })
                    .reply(202);

                await createClient(rpc).raiseEvent(taskHub, "TestEvent", null, {
                    taskHubName,
                    connectionName,
                });

                expect(scope.isDone()).to.equal(true);
            });

            for (const name of ["rewind", "terminate", "suspend", "resume"] as const) {
                it(`${name} keeps reason text out of URL syntax`, async () => {
                    const reason = "why?taskHub=Other&connection=Other#fragment+$&";
                    const query = rpc
                        ? { reason }
                        : { reason, taskHub, connection, code: "base64string" };
                    const scope = nock(origin)
                        .post(`${basePath}/instances/normal/${name}`)
                        .query(query)
                        .reply(202);

                    const client = createClient(rpc);
                    await client[name]("normal", reason);

                    expect(scope.isDone()).to.equal(true);
                });
            }
        });
    }
});
