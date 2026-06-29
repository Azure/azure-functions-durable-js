import { expect } from "chai";
import sinon = require("sinon");
import { grpc } from "../../src";

describe("Durable gRPC adapters", () => {
    describe("DurableFunctionsWorker", () => {
        it("delegates base64 orchestrator requests to the durabletask-js worker boundary", async () => {
            const request = Buffer.from("orchestrator request");
            const response = Buffer.from("orchestrator response");
            const executeOrchestratorRequest = sinon.stub().resolves(response);
            const worker = new grpc.DurableFunctionsWorker({
                executeOrchestratorRequest,
                executeEntityBatchRequest: sinon.stub().resolves(Buffer.from("unused")),
            });

            const actual = await worker.handleOrchestratorRequest(request.toString("base64"));

            expect(Buffer.from(actual, "base64").toString()).to.equal("orchestrator response");
            expect(executeOrchestratorRequest.callCount).to.equal(1);
            expect(Buffer.from(executeOrchestratorRequest.args[0][0]).toString()).to.equal(
                "orchestrator request"
            );
        });

        it("delegates base64 entity requests to the durabletask-js worker boundary", async () => {
            const request = Buffer.from("entity request");
            const response = Buffer.from("entity response");
            const executeEntityBatchRequest = sinon.stub().resolves(response);
            const worker = new grpc.DurableFunctionsWorker({
                executeOrchestratorRequest: sinon.stub().resolves(Buffer.from("unused")),
                executeEntityBatchRequest,
            });

            const actual = await worker.handleEntityBatchRequest(request.toString("base64"));

            expect(Buffer.from(actual, "base64").toString()).to.equal("entity response");
            expect(executeEntityBatchRequest.callCount).to.equal(1);
            expect(Buffer.from(executeEntityBatchRequest.args[0][0]).toString()).to.equal(
                "entity request"
            );
        });
    });

    describe("DurableFunctionsClient", () => {
        it("delegates startNew to the durabletask-js client boundary", async () => {
            const startNew = sinon.stub().resolves("instance-id");
            const client = new grpc.DurableFunctionsClient({
                taskHubName: "task-hub",
                startNew,
            });

            const actual = await client.startNew("orchestrator", {
                input: { value: 1 },
                instanceId: "instance-id",
            });

            expect(actual).to.equal("instance-id");
            expect(client.taskHubName).to.equal("task-hub");
            expect(startNew.callCount).to.equal(1);
            expect(startNew.args[0][0]).to.equal("orchestrator");
            expect(startNew.args[0][1]).to.deep.equal({
                input: { value: 1 },
                instanceId: "instance-id",
            });
        });
    });
});
