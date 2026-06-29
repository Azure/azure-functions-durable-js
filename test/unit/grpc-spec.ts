import { expect } from "chai";
import sinon = require("sinon");
import { grpc } from "../../src";

describe("Durable gRPC adapters", () => {
    const protobuf: grpc.DurableTaskGrpcProtobufHelpers = {
        decodeOrchestratorRequestFromBase64: (encodedRequest: string): unknown => ({
            kind: "orchestrator",
            value: Buffer.from(encodedRequest, "base64").toString(),
        }),
        encodeOrchestratorResponseToBase64: (response: unknown): string =>
            Buffer.from(JSON.stringify(response)).toString("base64"),
        decodeEntityBatchRequestFromBase64: (encodedRequest: string): unknown => ({
            kind: "entityBatch",
            value: Buffer.from(encodedRequest, "base64").toString(),
        }),
        encodeEntityBatchResultToBase64: (response: unknown): string =>
            Buffer.from(JSON.stringify(response)).toString("base64"),
        decodeEntityRequestFromBase64: (encodedRequest: string): unknown => ({
            kind: "entity",
            value: Buffer.from(encodedRequest, "base64").toString(),
        }),
    };

    describe("DurableFunctionsWorker", () => {
        it("uses durabletask-js protobuf helpers and worker execute API for orchestrator requests", async () => {
            const executeOrchestratorRequest = sinon.stub().resolves({
                kind: "orchestratorResponse",
            });
            const worker = new grpc.DurableFunctionsWorker(
                {
                    executeOrchestratorRequest,
                    executeEntityBatchRequest: sinon.stub().resolves({ kind: "unused" }),
                    executeEntityRequest: sinon.stub().resolves({ kind: "unused" }),
                },
                { protobuf }
            );

            const actual = await worker.handleOrchestratorRequest(
                Buffer.from("orchestrator request").toString("base64")
            );

            expect(JSON.parse(Buffer.from(actual, "base64").toString())).to.deep.equal({
                kind: "orchestratorResponse",
            });
            expect(executeOrchestratorRequest.callCount).to.equal(1);
            expect(executeOrchestratorRequest.args[0][0]).to.deep.equal({
                kind: "orchestrator",
                value: "orchestrator request",
            });
        });

        it("uses durabletask-js protobuf helpers and worker execute API for entity batch requests", async () => {
            const executeEntityBatchRequest = sinon.stub().resolves({
                kind: "entityBatchResponse",
            });
            const worker = new grpc.DurableFunctionsWorker(
                {
                    executeOrchestratorRequest: sinon.stub().resolves({ kind: "unused" }),
                    executeEntityBatchRequest,
                    executeEntityRequest: sinon.stub().resolves({ kind: "unused" }),
                },
                { protobuf }
            );

            const actual = await worker.handleEntityBatchRequest(
                Buffer.from("entity batch request").toString("base64")
            );

            expect(JSON.parse(Buffer.from(actual, "base64").toString())).to.deep.equal({
                kind: "entityBatchResponse",
            });
            expect(executeEntityBatchRequest.callCount).to.equal(1);
            expect(executeEntityBatchRequest.args[0][0]).to.deep.equal({
                kind: "entityBatch",
                value: "entity batch request",
            });
        });

        it("uses durabletask-js protobuf helpers and worker execute API for entity requests", async () => {
            const executeEntityRequest = sinon.stub().resolves({
                kind: "entityResponse",
            });
            const worker = new grpc.DurableFunctionsWorker(
                {
                    executeOrchestratorRequest: sinon.stub().resolves({ kind: "unused" }),
                    executeEntityBatchRequest: sinon.stub().resolves({ kind: "unused" }),
                    executeEntityRequest,
                },
                { protobuf }
            );

            const actual = await worker.handleEntityRequest(
                Buffer.from("entity request").toString("base64")
            );

            expect(JSON.parse(Buffer.from(actual, "base64").toString())).to.deep.equal({
                kind: "entityResponse",
            });
            expect(executeEntityRequest.callCount).to.equal(1);
            expect(executeEntityRequest.args[0][0]).to.deep.equal({
                kind: "entity",
                value: "entity request",
            });
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
    });
});
