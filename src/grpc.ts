import { HttpRequest, HttpResponse } from "@azure/functions";
import { StartNewOptions } from "durable-functions";
import { Metadata } from "@grpc/grpc-js";
import { MetadataGenerator, TaskHubGrpcClient } from "@microsoft/durabletask-js";
/** @hidden */
import url = require("url");
import { Constants } from "./Constants";
import { DurableClient } from "./durableClient/DurableClient";
import { OrchestrationClientInputData } from "./durableClient/OrchestrationClientInputData";
import { HttpCreationPayload } from "./http/HttpCreationPayload";
import { HttpManagementPayload } from "./http/HttpManagementPayload";

export interface DurableTaskGrpcWorker {
    processOrchestratorRequest(request: Uint8Array | Buffer): Promise<Uint8Array | Buffer>;
    processEntityBatchRequest(request: Uint8Array | Buffer): Promise<Uint8Array | Buffer>;
}

// TODO: The worker byte-processor API (`processOrchestratorRequest` / `processEntityBatchRequest`)
// is added by durabletask-js PR #282, which is not yet published. `DurableFunctionsWorker` injects
// that worker through the `DurableTaskGrpcWorker` interface above so it carries no compile-time
// dependency on the unpublished API. Once #282 publishes, bump `@microsoft/durabletask-js` in
// package.json past 0.3.0 and wire the worker directly to the package's `TaskHubGrpcWorker`.
export class DurableFunctionsWorker {
    public constructor(private readonly worker: DurableTaskGrpcWorker) {}

    public async handleOrchestratorRequest(encodedRequest: string): Promise<string> {
        const request = decodeBase64Request(encodedRequest, "orchestrator");
        const response = await this.worker.processOrchestratorRequest(request);
        return Buffer.from(response).toString("base64");
    }

    public async handleEntityBatchRequest(encodedRequest: string): Promise<string> {
        const request = decodeBase64Request(encodedRequest, "entity batch");
        const response = await this.worker.processEntityBatchRequest(request);
        return Buffer.from(response).toString("base64");
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

/**
 * The subset of the durabletask-js `TaskHubGrpcClient` surface that the Durable Functions
 * client builds on. The concrete `TaskHubGrpcClient` structurally satisfies this interface;
 * tests can inject a lightweight stub instead of a live gRPC channel.
 */
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

/**
 * Runtime configuration provided by the Durable Functions host to a durable client binding
 * when the app has opted into gRPC (`durableRequiresGrpc: true`). It mirrors the JSON payload
 * the extension serializes in gRPC ("middleware passthrough") mode.
 *
 * `rpcBaseUrl` is the address of the extension's local gRPC sidecar (e.g. `http://127.0.0.1:<port>`,
 * HTTP/2 plaintext), not the cloud Durable Task Scheduler. This matches the Python SDK, which
 * connects with `host_address=rpcBaseUrl` and `secure_channel=False`.
 */
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

/** @hidden */
const grpcInstanceIdPlaceholder = "@@DURABLE_GRPC_INSTANCE_ID@@";

/**
 * A durable client backed by the durabletask-js gRPC `TaskHubGrpcClient`.
 *
 * It mirrors the Python `DurableFunctionsClient`: orchestration and entity management calls are
 * forwarded to the gRPC client, while the Functions-specific HTTP helpers
 * (`createCheckStatusResponse` / `createHttpManagementPayload`) reuse the existing
 * {@link DurableClient} implementation.
 */
export class DurableFunctionsClient implements DurableTaskGrpcClient {
    public readonly taskHubName: string | undefined;

    private readonly httpHelper: DurableClient;

    public constructor(
        private readonly client: DurableTaskGrpcClient,
        options: DurableFunctionsClientOptions = {}
    ) {
        this.taskHubName = options.taskHubName;
        this.httpHelper = createHttpHelperClient(options);
    }

    /**
     * Builds a {@link DurableFunctionsClient} that connects to the extension's local gRPC sidecar
     * described by the durable client binding payload.
     */
    public static fromConfig(config: GrpcDurableClientConfig): DurableFunctionsClient {
        const grpcClient = createTaskHubGrpcClient(config);
        return new DurableFunctionsClient(grpcClient, {
            taskHubName: config.taskHubName,
            requiredQueryStringParameters: config.requiredQueryStringParameters,
            httpBaseUrl: config.httpBaseUrl,
        });
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

    public getEntity(entityId: DurableTaskEntityId, includeState?: boolean): Promise<unknown> {
        return callOptionalClientMethod(
            this.client,
            this.client.getEntity,
            "getEntity",
            entityId,
            includeState
        );
    }

    public createCheckStatusResponse(
        request: HttpRequest | undefined,
        instanceId: string
    ): HttpResponse {
        return this.httpHelper.createCheckStatusResponse(request, instanceId);
    }

    public createHttpManagementPayload(instanceId: string): HttpManagementPayload {
        return this.httpHelper.createHttpManagementPayload(instanceId);
    }

    public stop(): Promise<void> {
        if (!this.client.stop) {
            return Promise.resolve();
        }
        return this.client.stop();
    }
}

/** @hidden */
function createTaskHubGrpcClient(config: GrpcDurableClientConfig): DurableTaskGrpcClient {
    if (!config.rpcBaseUrl) {
        throw new TypeError(
            "Durable gRPC client configuration is missing rpcBaseUrl (the local gRPC sidecar address)."
        );
    }

    const client = new TaskHubGrpcClient({
        hostAddress: toGrpcHostAddress(config.rpcBaseUrl),
        // Plaintext localhost connection to the extension's local gRPC sidecar (mirrors Python's
        // secure_channel=False). The extension bridges to the real Durable Task backend.
        useTLS: false,
        metadataGenerator: createTaskHubMetadataGenerator(config.taskHubName),
    });

    // The concrete TaskHubGrpcClient structurally provides the methods declared on
    // DurableTaskGrpcClient; its richer return types are narrowed at this boundary.
    return (client as unknown) as DurableTaskGrpcClient;
}

/** @hidden */
function createTaskHubMetadataGenerator(taskHubName: string | undefined): MetadataGenerator {
    return async (): Promise<Metadata> => {
        const metadata = new Metadata();
        if (taskHubName) {
            metadata.set("taskhub", taskHubName);
        }
        // 'user-agent' is reserved by gRPC, so the taskhub backend reads 'x-user-agent' instead.
        metadata.set("x-user-agent", "durable-functions-nodejs");
        return metadata;
    };
}

/** @hidden */
function toGrpcHostAddress(rpcBaseUrl: string): string {
    // grpc-js expects a `host:port` authority with no scheme or path; the host provides a full
    // URL such as http://127.0.0.1:<port>.
    try {
        return new url.URL(rpcBaseUrl).host;
    } catch {
        return rpcBaseUrl.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "").replace(/\/.*$/, "");
    }
}

/** @hidden */
function createHttpHelperClient(options: DurableFunctionsClientOptions): DurableClient {
    const httpBaseUrl = normalizeHttpBaseUrl(options.httpBaseUrl);
    const requiredQueryStringParameters = options.requiredQueryStringParameters ?? "";

    const clientData = new OrchestrationClientInputData(
        options.taskHubName ?? "",
        buildCreationUrls(httpBaseUrl, requiredQueryStringParameters),
        buildManagementUrls(httpBaseUrl, requiredQueryStringParameters),
        httpBaseUrl,
        requiredQueryStringParameters
    );

    return new DurableClient(clientData);
}

/** @hidden */
function normalizeHttpBaseUrl(httpBaseUrl: string | undefined): string {
    const base =
        httpBaseUrl && httpBaseUrl.length > 0
            ? httpBaseUrl
            : `${Constants.DefaultLocalOrigin}/runtime/webhooks/durabletask`;
    return base.replace(/\/$/, "");
}

/**
 * Builds the management URL templates the Functions HTTP helpers operate on. In gRPC mode the host
 * no longer ships these templates, so they are reconstructed here exactly as the Python SDK does
 * (instance status URL + standard sub-routes + the host-provided required query string). The
 * placeholder is substituted with the real instance id by {@link DurableClient}.
 * @hidden
 */
function buildManagementUrls(
    httpBaseUrl: string,
    requiredQueryStringParameters: string
): HttpManagementPayload {
    const statusUrl = `${httpBaseUrl}/instances/${grpcInstanceIdPlaceholder}`;
    const suffix = requiredQueryStringParameters ? `?${requiredQueryStringParameters}` : "";
    const reasonSuffix = requiredQueryStringParameters
        ? `?reason={text}&${requiredQueryStringParameters}`
        : "?reason={text}";

    return new HttpManagementPayload(
        grpcInstanceIdPlaceholder,
        `${statusUrl}${suffix}`,
        `${statusUrl}/raiseEvent/{eventName}${suffix}`,
        `${statusUrl}/terminate${reasonSuffix}`,
        `${statusUrl}/rewind${reasonSuffix}`,
        `${statusUrl}${suffix}`,
        `${statusUrl}/suspend${reasonSuffix}`,
        `${statusUrl}/resume${reasonSuffix}`
    );
}

/** @hidden */
function buildCreationUrls(
    httpBaseUrl: string,
    requiredQueryStringParameters: string
): HttpCreationPayload {
    const createUrl = `${httpBaseUrl}/orchestrators/{functionName}`;
    const suffix = requiredQueryStringParameters ? `?${requiredQueryStringParameters}` : "";
    return new HttpCreationPayload(`${createUrl}${suffix}`, `${createUrl}${suffix}`);
}

/** @hidden */
function decodeBase64Request(encodedRequest: string, requestType: string): Buffer {
    if (!encodedRequest) {
        throw new TypeError(`${requestType} request must be a non-empty base64 string.`);
    }

    return Buffer.from(encodedRequest, "base64");
}

/** @hidden */
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
