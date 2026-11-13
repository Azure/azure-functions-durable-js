import { HttpRequest } from "@azure/functions";
import chai = require("chai");
import chaiAsPromised = require("chai-as-promised");
import nock = require("nock");
import { DurableClient } from "../../src/durableClient/DurableClient";
import { OrchestrationClientInputData } from "../../src/durableClient/OrchestrationClientInputData";
import { EntityId } from "../../src/entities/EntityId";
import { OrchestrationRuntimeStatus } from "../../src/orchestrations/OrchestrationRuntimeStatus";
import { TestUtils } from "../testobjects/testutils";

chai.use(chaiAsPromised);
const expect = chai.expect;
const origin = "http://127.0.0.1:19091";
const webhookPath = "/runtime/webhooks/durabletask";
const systemKey = "synthetic-INSTANCEID+key/=";

function binding(rpc: boolean, query: string): OrchestrationClientInputData {
    const data = TestUtils.createOrchestrationClientInputData("INSTANCEID", origin, "hub", "store");
    data.managementUrls = {
        ...data.managementUrls,
        restartPostUri: `${origin}${webhookPath}/instances/INSTANCEID/restart?taskHub=hub&connection=store`,
    };
    data.rpcBaseUrl = rpc ? `${origin}/durabletask/` : undefined;
    data.requiredQueryStringParameters = query;
    for (const payload of [data.creationUrls, data.managementUrls]) {
        for (const [name, value] of Object.entries(payload)) {
            if (name === "id" || !value) {
                continue;
            }
            const queryStart = value.indexOf("?");
            const base = queryStart < 0 ? value : value.slice(0, queryStart);
            const parameters = queryStart < 0 ? [] : value.slice(queryStart + 1).split("&");
            const preserved = parameters.filter(
                (parameter) => !/^(code|taskHub|connection)=/.test(parameter)
            );
            const suffix = [...preserved, query].filter(Boolean).join("&");
            payload[name] = base + (suffix ? `?${suffix}` : "");
        }
    }
    return data;
}

const bindings = [
    {
        name: "default/false host binding",
        query: `taskHub=hub&connection=store&code=${encodeURIComponent(systemKey)}`,
    },
    { name: "opt-in host binding", query: "taskHub=hub&connection=store" },
    { name: "opt-in host binding without query parameters", query: "" },
];

interface Operation {
    name: string;
    method: "get" | "post" | "delete";
    path: string;
    status: number;
    body: unknown;
    query?: Record<string, string>;
    invoke: (client: DurableClient) => Promise<unknown>;
}

const operations: Operation[] = [
    {
        name: "startNew",
        method: "post",
        path: "/orchestrators/Allowed",
        status: 202,
        body: { id: "instance" },
        invoke: (client) => client.startNew("Allowed"),
    },
    {
        name: "getStatus",
        method: "get",
        path: "/instances/instance",
        status: 200,
        body: {
            name: "Allowed",
            instanceId: "instance",
            runtimeStatus: "Running",
            createdTime: "2026-01-01T00:00:00Z",
            lastUpdatedTime: "2026-01-01T00:00:00Z",
            input: null,
            output: null,
        },
        invoke: (client) => client.getStatus("instance"),
    },
    {
        name: "getStatusAll",
        method: "get",
        path: "/instances/",
        status: 200,
        body: [],
        invoke: (client) => client.getStatusAll(),
    },
    {
        name: "getStatus with history options",
        method: "get",
        path: "/instances/instance",
        status: 200,
        body: {
            name: "Allowed",
            instanceId: "instance",
            runtimeStatus: "Running",
            createdTime: "2026-01-01T00:00:00Z",
            lastUpdatedTime: "2026-01-01T00:00:00Z",
            input: null,
            output: null,
        },
        query: { showHistory: "true", showHistoryOutput: "true", showInput: "true" },
        invoke: (client) =>
            client.getStatus("instance", {
                showHistory: true,
                showHistoryOutput: true,
                showInput: true,
            }),
    },
    {
        name: "purgeInstanceHistory",
        method: "delete",
        path: "/instances/instance",
        status: 200,
        body: { instancesDeleted: 1 },
        invoke: (client) => client.purgeInstanceHistory("instance"),
    },
    {
        name: "purgeInstanceHistoryBy",
        method: "delete",
        path: "/instances/",
        status: 200,
        body: { instancesDeleted: 1 },
        query: {
            createdTimeFrom: "2026-01-01T00:00:00.000Z",
            createdTimeTo: "2026-01-02T00:00:00.000Z",
            runtimeStatus: "Completed,Failed",
        },
        invoke: (client) =>
            client.purgeInstanceHistoryBy({
                createdTimeFrom: new Date("2026-01-01T00:00:00Z"),
                createdTimeTo: new Date("2026-01-02T00:00:00Z"),
                runtimeStatus: [
                    OrchestrationRuntimeStatus.Completed,
                    OrchestrationRuntimeStatus.Failed,
                ],
            }),
    },
    {
        name: "raiseEvent",
        method: "post",
        path: "/instances/instance/raiseEvent/event",
        status: 202,
        body: "",
        invoke: (client) => client.raiseEvent("instance", "event", {}),
    },
    ...(["rewind", "terminate", "suspend", "resume"] as const).map(
        (name): Operation => ({
            name,
            method: "post",
            path: `/instances/instance/${name}`,
            status: 202,
            body: "",
            invoke: (client) => client[name]("instance", "reason"),
        })
    ),
    {
        name: "restart",
        method: "post",
        path: "/instances/instance/restart",
        status: 202,
        body: { id: "restarted" },
        invoke: (client) => client.restart("instance"),
    },
    {
        name: "readEntityState",
        method: "get",
        path: "/entities/entity/key",
        status: 200,
        body: { value: 1 },
        invoke: (client) => client.readEntityState(new EntityId("entity", "key")),
    },
    {
        name: "signalEntity",
        method: "post",
        path: "/entities/entity/key",
        status: 202,
        body: "",
        invoke: (client) => client.signalEntity(new EntityId("entity", "key"), "operation", {}),
    },
];

describe("Client HTTP management compatibility", () => {
    before(() => {
        if (!nock.isActive()) {
            nock.activate();
        }
        nock.disableNetConnect();
    });

    afterEach(() => {
        nock.cleanAll();
    });

    after(() => {
        nock.enableNetConnect();
        nock.restore();
    });

    for (const { name, query } of bindings) {
        for (const operation of operations) {
            it(`${operation.name} preserves the query from a ${name}`, async () => {
                const client = new DurableClient(binding(false, query));
                const parameters = new URLSearchParams(query);
                const scope = nock(origin, { badheaders: ["x-functions-key"] })
                    [operation.method](`${webhookPath}${operation.path}`)
                    .query(
                        (actual: Record<string, unknown>) =>
                            actual.code === (parameters.get("code") ?? undefined) &&
                            [...parameters].every(([key, value]) => actual[key] === value) &&
                            Object.entries(operation.query ?? {}).every(
                                ([key, value]) => actual[key] === value
                            )
                    )
                    .reply(operation.status, operation.body);

                await operation.invoke(client);

                expect(scope.isDone()).to.equal(true);
            });
        }

        it(`preserves URLs and the string-only payload for a ${name}`, async () => {
            const data = binding(true, query);
            const original = JSON.stringify(data);
            const client = new DurableClient(data);
            const request = new HttpRequest({
                method: "GET",
                url: "https://frontend.test/api/start",
            });
            const response = client.createCheckStatusResponse(request, "instance");
            const payload = await response.json();

            const typedPayload = client.createHttpManagementPayload("instance");
            expect(payload).not.to.have.property("requiredHeaders");
            expect(payload).to.deep.equal(
                Object.fromEntries(
                    Object.entries(typedPayload).map(([key, value]) => [
                        key,
                        value.replace(origin, "https://frontend.test"),
                    ])
                )
            );
            expect(response.headers.get("Location")).to.equal(
                typedPayload.statusQueryGetUri.replace(origin, "https://frontend.test")
            );
            for (const [key, value] of Object.entries(typedPayload)) {
                if (key !== "id" && value) {
                    const expected = data.managementUrls[key].replace("INSTANCEID", "instance");
                    expect(value).to.equal(expected);
                    expect(new URL(value).searchParams.get("code")).to.equal(
                        new URLSearchParams(query).get("code")
                    );
                }
            }
            if (!new URLSearchParams(query).has("code")) {
                expect(JSON.stringify(payload)).not.to.contain(systemKey);
            }
            expect(JSON.stringify(data)).to.equal(original);
        });

        for (const operation of operations) {
            it(`${operation.name} uses local RPC without public credentials for a ${name}`, async () => {
                const client = new DurableClient(binding(true, query));
                const scope = nock(origin, { badheaders: ["x-functions-key"] })
                    [operation.method](`/durabletask${operation.path}`)
                    .query(
                        (actual: Record<string, unknown>) =>
                            !Object.keys(actual).some((key) => key.toLowerCase() === "code") &&
                            Object.entries(operation.query ?? {}).every(
                                ([key, value]) => actual[key] === value
                            )
                    )
                    .reply(operation.status, operation.body);

                await operation.invoke(client);

                expect(scope.isDone()).to.equal(true);
            });
        }
    }

    for (const query of [undefined, null, 123, true, {}]) {
        for (const operation of operations.filter(
            (operation) => operation.name === "readEntityState" || operation.name === "signalEntity"
        )) {
            it(`${operation.name} rejects a non-string binding query: ${JSON.stringify(
                query
            )}`, async () => {
                const data = binding(false, "");
                Object.defineProperty(data, "requiredQueryStringParameters", { value: query });

                await expect(operation.invoke(new DurableClient(data))).to.be.rejectedWith(
                    `Cannot use the ${operation.name} API with this version of the Durable Task Extension.`
                );
            });
        }
    }

    for (const query of [
        "CoDe=synthetic%2Bkey%2F%3D&site=value%2Bone",
        "%63ode=first%2Bkey&site=value%2Bone&CODE=duplicate",
    ]) {
        it(`preserves the host query verbatim: ${query}`, () => {
            const payload = new DurableClient(binding(false, query)).createHttpManagementPayload(
                "instance"
            );
            for (const [key, value] of Object.entries(payload)) {
                if (key !== "id" && value) {
                    expect(value).to.contain(query);
                }
            }
        });
    }

    it("uses the binding base URL for entity calls when link origins were normalized", async () => {
        const data = binding(false, "");
        for (const payload of [data.creationUrls, data.managementUrls]) {
            for (const [key, value] of Object.entries(payload)) {
                payload[key] = value.replace(origin, "http://localhost:19091");
            }
        }
        const scope = nock(origin, { badheaders: ["x-functions-key"] })
            .get(`${webhookPath}/entities/entity/key`)
            .query(true)
            .reply(200, { value: 1 });

        await new DurableClient(data).readEntityState(new EntityId("entity", "key"));

        expect(scope.isDone()).to.equal(true);
    });

    it("preserves the legacy query and continuation token on every status page", async () => {
        const client = new DurableClient(binding(false, bindings[0].query));
        const first = nock(origin, { badheaders: ["x-functions-key"] })
            .get(`${webhookPath}/instances/`)
            .query((query: Record<string, unknown>) => query.code === systemKey)
            .reply(200, [{ instanceId: "first" }], { "x-ms-continuation-token": "next" });
        const second = nock(origin, {
            reqheaders: {
                "x-ms-continuation-token": "next",
            },
            badheaders: ["x-functions-key"],
        })
            .get(`${webhookPath}/instances/`)
            .query((query: Record<string, unknown>) => query.code === systemKey)
            .reply(200, [{ instanceId: "second" }]);

        expect(await client.getStatusAll()).to.have.length(2);
        expect(first.isDone() && second.isDone()).to.equal(true);
    });
});
