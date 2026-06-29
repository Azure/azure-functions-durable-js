import { StartNewOptions } from "./durableClient";

export interface DurableTaskGrpcWorker {
    executeOrchestratorRequest(request: Uint8Array): Promise<Uint8Array>;
    executeEntityBatchRequest(request: Uint8Array): Promise<Uint8Array>;
}

export declare class DurableFunctionsWorker {
    constructor(worker: DurableTaskGrpcWorker);
    handleOrchestratorRequest(encodedRequest: string): Promise<string>;
    handleEntityBatchRequest(encodedRequest: string): Promise<string>;
}

export interface DurableTaskGrpcClient {
    readonly taskHubName: string;
    startNew(orchestratorFunctionName: string, options?: StartNewOptions): Promise<string>;
}

export declare class DurableFunctionsClient implements DurableTaskGrpcClient {
    readonly taskHubName: string;
    constructor(client: DurableTaskGrpcClient);
    startNew(orchestratorFunctionName: string, options?: StartNewOptions): Promise<string>;
}
