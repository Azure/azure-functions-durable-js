import { StartNewOptions } from "durable-functions";

export interface DurableTaskGrpcProtobufHelpers {
    decodeOrchestratorRequestFromBase64(encodedRequest: string): unknown;
    encodeOrchestratorResponseToBase64(response: unknown): string;
    decodeEntityBatchRequestFromBase64(encodedRequest: string): unknown;
    encodeEntityBatchResultToBase64(response: unknown): string;
    decodeEntityRequestFromBase64(encodedRequest: string): unknown;
}

export interface DurableTaskGrpcWorker {
    executeOrchestratorRequest(request: unknown): Promise<unknown>;
    executeEntityBatchRequest(request: unknown): Promise<unknown>;
    executeEntityRequest(request: unknown): Promise<unknown>;
}

export interface DurableFunctionsWorkerOptions {
    protobuf?: DurableTaskGrpcProtobufHelpers;
}

export class DurableFunctionsWorker {
    private readonly protobuf: DurableTaskGrpcProtobufHelpers;

    public constructor(
        private readonly worker: DurableTaskGrpcWorker,
        options: DurableFunctionsWorkerOptions = {}
    ) {
        this.protobuf = options.protobuf ?? loadDurableTaskGrpcProtobufHelpers();
    }

    public async handleOrchestratorRequest(encodedRequest: string): Promise<string> {
        validateBase64Request(encodedRequest, "orchestrator");
        const request = this.protobuf.decodeOrchestratorRequestFromBase64(encodedRequest);
        const response = await this.worker.executeOrchestratorRequest(request);
        return this.protobuf.encodeOrchestratorResponseToBase64(response);
    }

    public async handleEntityBatchRequest(encodedRequest: string): Promise<string> {
        validateBase64Request(encodedRequest, "entity batch");
        const request = this.protobuf.decodeEntityBatchRequestFromBase64(encodedRequest);
        const response = await this.worker.executeEntityBatchRequest(request);
        return this.protobuf.encodeEntityBatchResultToBase64(response);
    }

    public async handleEntityRequest(encodedRequest: string): Promise<string> {
        validateBase64Request(encodedRequest, "entity");
        const request = this.protobuf.decodeEntityRequestFromBase64(encodedRequest);
        const response = await this.worker.executeEntityRequest(request);
        return this.protobuf.encodeEntityBatchResultToBase64(response);
    }
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
    getEntity?<T = unknown>(
        entityId: DurableTaskEntityId,
        includeState?: boolean
    ): Promise<T | undefined>;
}

export interface DurableFunctionsClientOptions {
    taskHubName?: string;
}

export class DurableFunctionsClient implements DurableTaskGrpcClient {
    public readonly taskHubName: string | undefined;

    public constructor(
        private readonly client: DurableTaskGrpcClient,
        options: DurableFunctionsClientOptions = {}
    ) {
        this.taskHubName = options.taskHubName;
    }

    public startNew(orchestratorFunctionName: string, options?: StartNewOptions): Promise<string> {
        return this.scheduleNewOrchestration(orchestratorFunctionName, options?.input, {
            instanceId: options?.instanceId,
            version: options?.version,
        });
    }

    public scheduleNewOrchestration(
        orchestratorFunctionName: string,
        input?: unknown,
        options?: DurableTaskStartOrchestrationOptions
    ): Promise<string> {
        return this.client.scheduleNewOrchestration(orchestratorFunctionName, input, options);
    }

    public getOrchestrationState(instanceId: string, fetchPayloads?: boolean): Promise<unknown> {
        return callOptionalClientMethod(
            this.client,
            this.client.getOrchestrationState,
            "getOrchestrationState",
            instanceId,
            fetchPayloads
        );
    }

    public raiseOrchestrationEvent(
        instanceId: string,
        eventName: string,
        data?: unknown
    ): Promise<void> {
        return callOptionalClientMethod(
            this.client,
            this.client.raiseOrchestrationEvent,
            "raiseOrchestrationEvent",
            instanceId,
            eventName,
            data
        );
    }

    public terminateOrchestration(instanceId: string, outputOrOptions?: unknown): Promise<void> {
        return callOptionalClientMethod(
            this.client,
            this.client.terminateOrchestration,
            "terminateOrchestration",
            instanceId,
            outputOrOptions
        );
    }

    public suspendOrchestration(instanceId: string): Promise<void> {
        return callOptionalClientMethod(
            this.client,
            this.client.suspendOrchestration,
            "suspendOrchestration",
            instanceId
        );
    }

    public resumeOrchestration(instanceId: string): Promise<void> {
        return callOptionalClientMethod(
            this.client,
            this.client.resumeOrchestration,
            "resumeOrchestration",
            instanceId
        );
    }

    public purgeOrchestration(instanceId: string): Promise<unknown> {
        return callOptionalClientMethod(
            this.client,
            this.client.purgeOrchestration,
            "purgeOrchestration",
            instanceId
        );
    }

    public signalEntity(
        entityId: DurableTaskEntityId,
        operationName: string,
        input?: unknown
    ): Promise<void> {
        return callOptionalClientMethod(
            this.client,
            this.client.signalEntity,
            "signalEntity",
            entityId,
            operationName,
            input
        );
    }

    public getEntity<T = unknown>(
        entityId: DurableTaskEntityId,
        includeState?: boolean
    ): Promise<T | undefined> {
        if (!this.client.getEntity) {
            return Promise.reject(new Error("Durable gRPC client does not provide getEntity()."));
        }

        return this.client.getEntity<T>(entityId, includeState);
    }
}

function validateBase64Request(encodedRequest: string, requestType: string): void {
    if (!encodedRequest) {
        throw new TypeError(`${requestType} request must be a non-empty base64 string.`);
    }
}

function loadDurableTaskGrpcProtobufHelpers(): DurableTaskGrpcProtobufHelpers {
    try {
        return module.require("@microsoft/durabletask-js") as DurableTaskGrpcProtobufHelpers;
    } catch (error) {
        const message = error instanceof Error ? ` ${error.message}` : "";
        throw new Error(
            `Durable gRPC execution requires @microsoft/durabletask-js with Functions gRPC helpers.${message}`
        );
    }
}

function callOptionalClientMethod<TArgs extends unknown[], TResult>(
    client: DurableTaskGrpcClient,
    method: ((...args: TArgs) => Promise<TResult>) | undefined,
    methodName: string,
    ...args: TArgs
): Promise<TResult> {
    if (!method) {
        return Promise.reject(new Error(`Durable gRPC client does not provide ${methodName}().`));
    }

    return method.apply(client, args);
}
