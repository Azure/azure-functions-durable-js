import { expect } from "chai";
import sinon = require("sinon");
import { grpc } from "../../src";

describe("Durable gRPC adapters", () => {
    describe("DurableFunctionsWorker", () => {
        it("passes raw orchestrator request bytes to the durabletask-js worker", async () => {
            const processOrchestratorRequest = sinon
                .stub()
                .resolves(Buffer.from("orchestrator response"));
            const worker = new grpc.DurableFunctionsWorker({
                processOrchestratorRequest,
                processEntityBatchRequest: sinon.stub().resolves(Buffer.from("unused")),
            });

            const actual = await worker.handleOrchestratorRequest(
                Buffer.from("orchestrator request").toString("base64")
            );

            expect(Buffer.from(actual, "base64").toString()).to.equal("orchestrator response");
            expect(processOrchestratorRequest.callCount).to.equal(1);
            expect(Buffer.from(processOrchestratorRequest.args[0][0]).toString()).to.equal(
                "orchestrator request"
            );
        });

        it("passes raw entity batch request bytes to the durabletask-js worker", async () => {
            const processEntityBatchRequest = sinon
                .stub()
                .resolves(Buffer.from("entity batch response"));
            const worker = new grpc.DurableFunctionsWorker({
                processOrchestratorRequest: sinon.stub().resolves(Buffer.from("unused")),
                processEntityBatchRequest,
            });

            const actual = await worker.handleEntityBatchRequest(
                Buffer.from("entity batch request").toString("base64")
            );

            expect(Buffer.from(actual, "base64").toString()).to.equal("entity batch response");
            expect(processEntityBatchRequest.callCount).to.equal(1);
            expect(Buffer.from(processEntityBatchRequest.args[0][0]).toString()).to.equal(
                "entity batch request"
            );
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
