import { expect } from "chai";
import sinon = require("sinon");
import { grpc } from "../../src";

describe("Durable gRPC adapters", () => {
    describe("DurableFunctionsWorker", () => {
        it("decodes base64, delegates to processOrchestratorRequest, and re-encodes the response", async () => {
            const responseBytes = Buffer.from("orchestrator response");
            const processOrchestratorRequest = sinon.stub().resolves(responseBytes);
            const worker = new grpc.DurableFunctionsWorker({
                processOrchestratorRequest,
                processEntityBatchRequest: sinon.stub().resolves(Buffer.from("unused")),
            });

            const actual = await worker.handleOrchestratorRequest(
                Buffer.from("orchestrator request").toString("base64")
            );

            expect(actual).to.equal(responseBytes.toString("base64"));
            expect(processOrchestratorRequest.callCount).to.equal(1);
            expect(Buffer.from(processOrchestratorRequest.args[0][0]).toString()).to.equal(
                "orchestrator request"
            );
        });

        it("decodes base64, delegates to processEntityBatchRequest, and re-encodes the result", async () => {
            const responseBytes = Buffer.from("entity batch result");
            const processEntityBatchRequest = sinon.stub().resolves(responseBytes);
            const worker = new grpc.DurableFunctionsWorker({
                processOrchestratorRequest: sinon.stub().resolves(Buffer.from("unused")),
                processEntityBatchRequest,
            });

            const actual = await worker.handleEntityBatchRequest(
                Buffer.from("entity batch request").toString("base64")
            );

            expect(actual).to.equal(responseBytes.toString("base64"));
            expect(processEntityBatchRequest.callCount).to.equal(1);
            expect(Buffer.from(processEntityBatchRequest.args[0][0]).toString()).to.equal(
                "entity batch request"
            );
        });

        it("rejects empty base64 requests", async () => {
            const worker = new grpc.DurableFunctionsWorker({
                processOrchestratorRequest: sinon.stub().resolves(Buffer.from("unused")),
                processEntityBatchRequest: sinon.stub().resolves(Buffer.from("unused")),
            });

            try {
                await worker.handleOrchestratorRequest("");
                throw new Error("Expected handleOrchestratorRequest to throw.");
            } catch (error) {
                expect(error).to.be.instanceOf(TypeError);
            }
        });
    });

    describe("DurableFunctionsClient", () => {
        it("maps startNew to the durabletask-js scheduleNewOrchestration API", async () => {
            const scheduleNewOrchestration = sinon.stub().resolves("instance-id");
            const client = new grpc.DurableFunctionsClient(
                {
                    scheduleNewOrchestration,
                },
                { taskHubName: "task-hub" }
            );

            const actual = await client.startNew("orchestrator", {
                input: { value: 1 },
                instanceId: "instance-id",
                version: "v2",
            });

            expect(actual).to.equal("instance-id");
            expect(client.taskHubName).to.equal("task-hub");
            expect(scheduleNewOrchestration.callCount).to.equal(1);
            expect(scheduleNewOrchestration.args[0][0]).to.equal("orchestrator");
            expect(scheduleNewOrchestration.args[0][1]).to.deep.equal({ value: 1 });
            expect(scheduleNewOrchestration.args[0][2]).to.deep.equal({
                instanceId: "instance-id",
                version: "v2",
            });
        });

        it("delegates optional durabletask-js client methods when available", async () => {
            const raiseOrchestrationEvent = sinon.stub().resolves();
            const client = new grpc.DurableFunctionsClient({
                scheduleNewOrchestration: sinon.stub().resolves("unused"),
                raiseOrchestrationEvent,
            });

            await client.raiseOrchestrationEvent("instance-id", "eventName", { ok: true });

            expect(raiseOrchestrationEvent.callCount).to.equal(1);
            expect(raiseOrchestrationEvent.args[0]).to.deep.equal([
                "instance-id",
                "eventName",
                { ok: true },
            ]);
        });

        it("surfaces missing optional durabletask-js client APIs", async () => {
            const client = new grpc.DurableFunctionsClient({
                scheduleNewOrchestration: sinon.stub().resolves("unused"),
            });

            try {
                await client.raiseOrchestrationEvent("instance-id", "eventName");
                throw new Error("Expected raiseOrchestrationEvent to throw.");
            } catch (error) {
                expect(error).to.be.instanceOf(Error);
                expect((error as Error).message).to.equal(
                    "Durable gRPC client does not provide raiseOrchestrationEvent()."
                );
            }
        });

        it("resolves stop() even when the underlying client cannot stop", async () => {
            const client = new grpc.DurableFunctionsClient({
                scheduleNewOrchestration: sinon.stub().resolves("unused"),
            });

            await client.stop();
        });
    });

    describe("DurableFunctionsClient HTTP management helpers", () => {
        it("builds management payloads from httpBaseUrl and substitutes the instance id", () => {
            const client = new grpc.DurableFunctionsClient(
                { scheduleNewOrchestration: sinon.stub().resolves("unused") },
                {
                    taskHubName: "task-hub",
                    httpBaseUrl: "http://localhost:7071/runtime/webhooks/durabletask",
                    requiredQueryStringParameters: "code=secret",
                }
            );

            const payload = client.createHttpManagementPayload("instance-42");

            expect(payload.id).to.equal("instance-42");
            expect(payload.statusQueryGetUri).to.equal(
                "http://localhost:7071/runtime/webhooks/durabletask/instances/instance-42?code=secret"
            );
            expect(payload.sendEventPostUri).to.equal(
                "http://localhost:7071/runtime/webhooks/durabletask/instances/instance-42/raiseEvent/{eventName}?code=secret"
            );
            expect(payload.terminatePostUri).to.equal(
                "http://localhost:7071/runtime/webhooks/durabletask/instances/instance-42/terminate?reason={text}&code=secret"
            );
            expect(payload.purgeHistoryDeleteUri).to.equal(
                "http://localhost:7071/runtime/webhooks/durabletask/instances/instance-42?code=secret"
            );
        });

        it("falls back to the default local origin when httpBaseUrl is absent", () => {
            const client = new grpc.DurableFunctionsClient(
                { scheduleNewOrchestration: sinon.stub().resolves("unused") },
                { taskHubName: "task-hub" }
            );

            const payload = client.createHttpManagementPayload("abc");

            expect(payload.statusQueryGetUri).to.equal(
                "http://localhost:7071/runtime/webhooks/durabletask/instances/abc"
            );
        });
    });

    describe("DurableFunctionsClient.fromConfig", () => {
        it("builds a gRPC-backed client from the durable client binding payload", async () => {
            const client = grpc.DurableFunctionsClient.fromConfig({
                taskHubName: "task-hub",
                rpcBaseUrl: "http://127.0.0.1:4001",
                httpBaseUrl: "http://localhost:7071/runtime/webhooks/durabletask",
                requiredQueryStringParameters: "code=secret",
            });

            try {
                expect(client).to.be.instanceOf(grpc.DurableFunctionsClient);
                expect(client.taskHubName).to.equal("task-hub");

                const payload = client.createHttpManagementPayload("instance-7");
                expect(payload.statusQueryGetUri).to.equal(
                    "http://localhost:7071/runtime/webhooks/durabletask/instances/instance-7?code=secret"
                );
            } finally {
                await client.stop();
            }
        });

        it("throws when the gRPC sidecar address (rpcBaseUrl) is missing", () => {
            expect(() =>
                grpc.DurableFunctionsClient.fromConfig({ taskHubName: "task-hub" })
            ).to.throw(/rpcBaseUrl/);
        });
    });
});
