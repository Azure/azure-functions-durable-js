import { StartNewOptions } from "durable-functions";

export interface DurableTaskGrpcWorker {
    executeOrchestratorRequest(request: Uint8Array): Promise<Uint8Array>;
    executeEntityBatchRequest(request: Uint8Array): Promise<Uint8Array>;
}

export class DurableFunctionsWorker {
    public constructor(private readonly worker: DurableTaskGrpcWorker) {}

    public async handleOrchestratorRequest(encodedRequest: string): Promise<string> {
        const request = decodeBase64Request(encodedRequest, "orchestrator");
        const response = await this.worker.executeOrchestratorRequest(request);
        return Buffer.from(response).toString("base64");
    }

    public async handleEntityBatchRequest(encodedRequest: string): Promise<string> {
        const request = decodeBase64Request(encodedRequest, "entity");
        const response = await this.worker.executeEntityBatchRequest(request);
        return Buffer.from(response).toString("base64");
    }
}

export interface DurableTaskGrpcClient {
    readonly taskHubName: string;
    startNew(orchestratorFunctionName: string, options?: StartNewOptions): Promise<string>;
}

// TODO: Expand this adapter as durabletask-js exposes the remaining client operations.
export class DurableFunctionsClient implements DurableTaskGrpcClient {
    public readonly taskHubName: string;

    public constructor(private readonly client: DurableTaskGrpcClient) {
        this.taskHubName = client.taskHubName;
    }

    public startNew(orchestratorFunctionName: string, options?: StartNewOptions): Promise<string> {
        return this.client.startNew(orchestratorFunctionName, options);
    }
}

function decodeBase64Request(encodedRequest: string, requestType: string): Buffer {
    if (!encodedRequest) {
        throw new TypeError(`${requestType} request must be a non-empty base64 string.`);
    }

    return Buffer.from(encodedRequest, "base64");
}
