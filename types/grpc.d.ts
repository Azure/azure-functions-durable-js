import { HttpRequest, HttpResponse } from "@azure/functions";
import { HttpManagementPayload, StartNewOptions } from "./durableClient";

export interface DurableTaskGrpcWorker {
    processOrchestratorRequest(request: Uint8Array | Buffer): Promise<Uint8Array | Buffer>;
    processEntityBatchRequest(request: Uint8Array | Buffer): Promise<Uint8Array | Buffer>;
}

export declare class DurableFunctionsWorker {
    constructor(worker: DurableTaskGrpcWorker);
    handleOrchestratorRequest(encodedRequest: string): Promise<string>;
    handleEntityBatchRequest(encodedRequest: string): Promise<string>;
}

export interface DurableTaskStartOrchestrationOptions {
    instanceId?: string;
    startAt?: Date;
    version?: string;
    tags?: Record<string, string>;
}

export interface DurableTaskEntityId {
    toString(): string;
}

export interface DurableTaskGrpcClient {
    scheduleNewOrchestration(
        orchestratorFunctionName: string,
        input?: unknown,
        options?: DurableTaskStartOrchestrationOptions
    ): Promise<string>;
    getOrchestrationState?(instanceId: string, fetchPayloads?: boolean): Promise<unknown>;
    raiseOrchestrationEvent?(instanceId: string, eventName: string, data?: unknown): Promise<void>;
    terminateOrchestration?(instanceId: string, outputOrOptions?: unknown): Promise<void>;
    suspendOrchestration?(instanceId: string): Promise<void>;
    resumeOrchestration?(instanceId: string): Promise<void>;
    purgeOrchestration?(instanceId: string): Promise<unknown>;
    signalEntity?(
        entityId: DurableTaskEntityId,
        operationName: string,
        input?: unknown
    ): Promise<void>;
    getEntity?(entityId: DurableTaskEntityId, includeState?: boolean): Promise<unknown>;
    stop?(): Promise<void>;
}

export interface GrpcDurableClientConfig {
    taskHubName?: string;
    rpcBaseUrl?: string;
    requiredQueryStringParameters?: string;
    httpBaseUrl?: string;
}

export interface DurableFunctionsClientOptions {
    taskHubName?: string;
    requiredQueryStringParameters?: string;
    httpBaseUrl?: string;
}

export declare class DurableFunctionsClient implements DurableTaskGrpcClient {
    readonly taskHubName: string | undefined;
    constructor(client: DurableTaskGrpcClient, options?: DurableFunctionsClientOptions);
    static fromConfig(config: GrpcDurableClientConfig): DurableFunctionsClient;
    startNew(orchestratorFunctionName: string, options?: StartNewOptions): Promise<string>;
    scheduleNewOrchestration(
        orchestratorFunctionName: string,
        input?: unknown,
        options?: DurableTaskStartOrchestrationOptions
    ): Promise<string>;
    getOrchestrationState(instanceId: string, fetchPayloads?: boolean): Promise<unknown>;
    raiseOrchestrationEvent(instanceId: string, eventName: string, data?: unknown): Promise<void>;
    terminateOrchestration(instanceId: string, outputOrOptions?: unknown): Promise<void>;
    suspendOrchestration(instanceId: string): Promise<void>;
    resumeOrchestration(instanceId: string): Promise<void>;
    purgeOrchestration(instanceId: string): Promise<unknown>;
    signalEntity(
        entityId: DurableTaskEntityId,
        operationName: string,
        input?: unknown
    ): Promise<void>;
    getEntity(entityId: DurableTaskEntityId, includeState?: boolean): Promise<unknown>;
    createCheckStatusResponse(request: HttpRequest | undefined, instanceId: string): HttpResponse;
    createHttpManagementPayload(instanceId: string): HttpManagementPayload;
    stop(): Promise<void>;
}
