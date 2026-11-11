import { HttpRequest } from "@azure/functions";
import chai = require("chai");
import chaiAsPromised = require("chai-as-promised");
import nock = require("nock");
import { DurableClient } from "../../src/durableClient/DurableClient";
import { OrchestrationClientInputData } from "../../src/durableClient/OrchestrationClientInputData";
import { EntityId } from "../../src/entities/EntityId";
import { WebhookUtils } from "../../src/util/WebhookUtils";
import { TestUtils } from "../testobjects/testutils";

chai.use(chaiAsPromised);
const expect = chai.expect;
const origin = "http://127.0.0.1:19091";
const webhookPath = "/runtime/webhooks/durabletask";
const systemKey = "synthetic-INSTANCEID+key/=";

function binding(rpc: boolean, legacy: boolean): OrchestrationClientInputData {
    const data = TestUtils.createOrchestrationClientInputData("INSTANCEID", origin, "hub", "store");
    data.managementUrls = {
        ...data.managementUrls,
        restartPostUri: `${origin}${webhookPath}/instances/INSTANCEID/restart?taskHub=hub&connection=store`,
        requiredHeaders: {},
    };
    data.creationUrls = { ...data.creationUrls, requiredHeaders: {} };
    data.rpcBaseUrl = rpc ? `${origin}/durabletask/` : undefined;
    data.requiredHeaders = legacy ? undefined : { "x-functions-key": systemKey };
    data.requiredQueryStringParameters = legacy ? `CoDe=${encodeURIComponent(systemKey)}` : "";
    for (const payload of [data.creationUrls, data.managementUrls]) {
        if (legacy) {
            for (const [name, value] of Object.entries(payload)) {
                if (name !== "id" && typeof value === "string" && value) {
                    payload[name] =
                        value +
                        (value.includes("?") ? "&" : "?") +
                        data.requiredQueryStringParameters;
                }
            }
        }
    }
    return data;
}

interface Operation {
    name: string;
    method: "get" | "post" | "delete";
    path: string;
    status: number;
    body: unknown;
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
        invoke: (client) =>
            client.purgeInstanceHistoryBy({ createdTimeFrom: new Date("2026-01-01T00:00:00Z") }),
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

describe("Client HTTP management authentication", () => {
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

    for (const legacy of [false, true]) {
        for (const operation of operations) {
            it(`${operation.name} sends headers without query keys for a ${
                legacy ? "legacy" : "header-based"
            } binding`, async () => {
                const client = new DurableClient(binding(false, legacy));
                const scope = nock(origin, { reqheaders: { "x-functions-key": systemKey } })
                    [operation.method](`${webhookPath}${operation.path}`)
                    .query((query: Record<string, unknown>) =>
                        Object.keys(query).every((name) => name.toLowerCase() !== "code")
                    )
                    .reply(operation.status, operation.body);

                await operation.invoke(client);

                expect(scope.isDone()).to.equal(true);
            });
        }

        it(`returns secret-free URLs and unchanged header metadata for a ${
            legacy ? "legacy" : "header-based"
        } binding`, async () => {
            const data = binding(true, legacy);
            const original = JSON.stringify(data);
            const client = new DurableClient(data);
            const request = new HttpRequest({
                method: "GET",
                url: "https://frontend.test/api/start",
            });
            const response = client.createCheckStatusResponse(request, "instance");
            const payload = await response.json();

            expect(response.headers.get("Cache-Control")).to.equal("no-store");
            expect(response.headers.get("Location")).not.to.contain("code=");
            expect(payload).to.have.property("requiredHeaders");
            const typedPayload = client.createHttpManagementPayload("instance");
            expect(typedPayload.requiredHeaders).to.deep.equal({ "x-functions-key": systemKey });
            for (const [name, value] of Object.entries(typedPayload)) {
                if (name !== "id" && typeof value === "string" && value) {
                    expect(value.toLowerCase()).not.to.contain("code=");
                    expect(value).not.to.contain("synthetic");
                    expect(value).to.contain("taskHub=hub&connection=store");
                }
            }
            expect(JSON.stringify(payload)).to.contain(systemKey);
            expect(JSON.stringify(data)).to.equal(original);
        });
    }

    for (const operation of operations) {
        it(`${operation.name} does not send the public system key to local RPC`, async () => {
            const client = new DurableClient(binding(true, false));
            const scope = nock(origin, { badheaders: ["x-functions-key"] })
                [operation.method](`/durabletask${operation.path}`)
                .query(true)
                .reply(operation.status, operation.body);

            await operation.invoke(client);

            expect(scope.isDone()).to.equal(true);
        });
    }

    it("preserves encoded non-secret parameters and removes duplicate or encoded key names", () => {
        const headers: Record<string, string> = {};
        const value = WebhookUtils.removeSystemKey(
            `${origin}/instances/{id}?%63ode=first%2Bkey%2F%3D&site=value%2Bone&CODE=duplicate#fragment`,
            headers
        );
        expect(value).to.equal(`${origin}/instances/{id}?site=value%2Bone#fragment`);
        expect(headers).to.deep.equal({ "x-functions-key": "first+key/=" });
    });

    it("prefers explicit binding headers over legacy URL keys", () => {
        const data = binding(false, true);
        data.requiredHeaders = { "X-Functions-Key": "current-key" };
        expect(
            new DurableClient(data).createHttpManagementPayload("instance").requiredHeaders
        ).to.deep.equal({ "x-functions-key": "current-key" });
    });

    it("authenticates entity calls to the binding base URL when link origins were normalized", async () => {
        const data = binding(false, false);
        data.baseUrl = "http://0.0.0.0:12345/runtime/webhooks/durabletask";
        const scope = nock("http://0.0.0.0:12345", {
            reqheaders: { "x-functions-key": systemKey },
        })
            .get(`${webhookPath}/entities/entity/key`)
            .query(true)
            .reply(200, { value: 1 });

        await new DurableClient(data).readEntityState(new EntityId("entity", "key"));

        expect(scope.isDone()).to.equal(true);
    });

    it("does not send credentials to an origin absent from the binding", async () => {
        const data = binding(false, false);
        const client = new DurableClient(data);
        data.managementUrls = {
            ...data.managementUrls,
            statusQueryGetUri: "http://unrelated.test/instances/INSTANCEID",
        };

        await expect(client.getStatus("instance")).to.be.rejectedWith(
            "Cannot send management authentication headers to an unknown webhook origin."
        );
    });

    it("keeps authentication and continuation headers on every status page", async () => {
        const client = new DurableClient(binding(false, false));
        const first = nock(origin, { reqheaders: { "x-functions-key": systemKey } })
            .get(`${webhookPath}/instances/`)
            .query(true)
            .reply(200, [{ instanceId: "first" }], { "x-ms-continuation-token": "next" });
        const second = nock(origin, {
            reqheaders: {
                "x-functions-key": systemKey,
                "x-ms-continuation-token": "next",
            },
        })
            .get(`${webhookPath}/instances/`)
            .query(true)
            .reply(200, [{ instanceId: "second" }]);

        expect(await client.getStatusAll()).to.have.length(2);
        expect(first.isDone() && second.isDone()).to.equal(true);
    });

    it("does not forward key headers when the public endpoint redirects", async () => {
        const client = new DurableClient(binding(false, false));
        const source = nock(origin, { reqheaders: { "x-functions-key": systemKey } })
            .get(`${webhookPath}/instances/instance`)
            .query(true)
            .reply(302, "", { Location: "http://unrelated.test/collect" });
        const destination = nock("http://unrelated.test").get("/collect").reply(200);

        await expect(client.getStatus("instance")).to.be.rejectedWith(
            "unexpected status code: 302"
        );
        expect(source.isDone()).to.equal(true);
        expect(destination.isDone()).to.equal(false);
    });
});
