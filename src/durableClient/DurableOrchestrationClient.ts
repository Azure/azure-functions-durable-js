// tslint:disable:member-access

import { HttpRequest, HttpResponse } from "@azure/functions";
import axios, { AxiosInstance, AxiosResponse } from "axios";
/** @hidden */
import process = require("process");
/** @hidden */
import url = require("url");
import { isURL } from "validator";
import {
    StartNewOptions,
    DurableClient,
    GetStatusOptions,
    OrchestrationFilter,
    TaskHubOptions,
    WaitForCompletionOptions,
} from "durable-functions";
import { WebhookUtils } from "../util/WebhookUtils";
import { OrchestrationClientInputData } from "./OrchestrationClientInputData";
import { HttpManagementPayload } from "../http/HttpManagementPayload";
import { DurableOrchestrationStatus } from "../orchestrations/DurableOrchestrationStatus";
import { PurgeHistoryResult } from "./PurgeHistoryResult";
import { EntityId } from "../entities/EntityId";
import { EntityStateResponse } from "../entities/EntityStateResponse";
import { OrchestrationRuntimeStatus } from "../orchestrations/OrchestrationRuntimeStatus";
import { Utils } from "../util/Utils";

/**
 * Client for starting, querying, terminating and raising events to
 * orchestration instances.
 */
export class DurableOrchestrationClient implements DurableClient {
    public readonly taskHubName: string;
    /** @hidden */
    public readonly uniqueWebhookOrigins: string[];

    private readonly axiosInstance: AxiosInstance;

    private readonly eventNamePlaceholder = "{eventName}";
    private readonly functionNamePlaceholder = "{functionName}";
    private readonly instanceIdPlaceholder = "[/{instanceId}]";
    private readonly reasonPlaceholder = "{text}";

    private readonly createdTimeFromQueryKey = "createdTimeFrom";
    private readonly createdTimeToQueryKey = "createdTimeTo";
    private readonly runtimeStatusQueryKey = "runtimeStatus";
    private readonly showHistoryQueryKey = "showHistory";
    private readonly showHistoryOutputQueryKey = "showHistoryOutput";
    private readonly showInputQueryKey = "showInput";

    private urlValidationOptions: ValidatorJS.IsURLOptions = {
        protocols: ["http", "https"],
        require_tld: false,
        require_protocol: true,
        require_valid_protocol: true,
    };

    /**
     * @param clientData The object representing the orchestrationClient input
     *  binding of the Azure function that will use this client.
     */
    constructor(private readonly clientData: OrchestrationClientInputData) {
        if (!clientData) {
            throw new TypeError(
                `clientData: Expected OrchestrationClientInputData but got ${typeof clientData}`
            );
        }

        this.axiosInstance = axios.create({
            validateStatus: (status: number) => status < 600,
            headers: {
                post: {
                    "Content-Type": "application/json",
                },
            },
            maxContentLength: Infinity,
        });
        this.taskHubName = this.clientData.taskHubName;
        this.uniqueWebhookOrigins = this.extractUniqueWebhookOrigins(this.clientData);
    }

    public createCheckStatusResponse(
        request: HttpRequest | undefined,
        instanceId: string
    ): HttpResponse {
        const httpManagementPayload: HttpManagementPayload = this.getClientResponseLinks(
            request,
            instanceId
        );

        return new HttpResponse({
            status: 202,
            jsonBody: httpManagementPayload,
            headers: {
                "Content-Type": "application/json",
                Location: httpManagementPayload.statusQueryGetUri,
                "Retry-After": "10",
            },
        });
    }

    public createHttpManagementPayload(instanceId: string): HttpManagementPayload {
        return this.getClientResponseLinks(undefined, instanceId);
    }

    public async getStatus(
        instanceId: string,
        options: GetStatusOptions = {}
    ): Promise<DurableOrchestrationStatus> {
        const internalOptions: GetStatusInternalOptions = {
            instanceId,
            ...options,
        };
        const response: AxiosResponse = await this.getStatusInternal(internalOptions);

        switch (response.status) {
            case 200: // instance completed, failed or terminated
            case 202: // instance running or pending
            case 400:
                if (!response.data) {
                    throw new Error(
                        `DurableClient error: the Durable Functions extension replied with an empty HTTP ${response.status} response.`
                    );
                }

                try {
                    return new DurableOrchestrationStatus(response.data);
                } catch (error) {
                    throw new Error(
                        `DurableClient error: could not construct a DurableOrchestrationStatus object using the data received from the Durable Functions extension: ${error.message}`
                    );
                }

            case 404: // instance not found
                let msg =
                    `DurableClient error: Durable Functions extension replied with HTTP 404 response. ` +
                    `This usually means we could not find any data associated with the instanceId provided: ${instanceId}.`;
                if (response.data) {
                    msg += ` Details: ${JSON.stringify(response.data)}`;
                }
                throw new Error(msg);
            case 500: // request failed with unhandled exception (response data contains exception details)
            default:
                return Promise.reject(this.createGenericError(response));
        }
    }

    public async getStatusAll(): Promise<DurableOrchestrationStatus[]> {
        const response = await this.getStatusInternal({});
        switch (response.status) {
            case 200:
                return response.data as DurableOrchestrationStatus[];
            default:
                return Promise.reject(this.createGenericError(response));
        }
    }

    public async getStatusBy(filter: OrchestrationFilter): Promise<DurableOrchestrationStatus[]> {
        const response = await this.getStatusInternal(filter);
        switch (response.status) {
            case 200:
                return response.data as DurableOrchestrationStatus[];
            default:
                return Promise.reject(this.createGenericError(response));
        }
    }

    public async purgeInstanceHistory(instanceId: string): Promise<PurgeHistoryResult> {
        let requestUrl: string;
        if (this.clientData.rpcBaseUrl) {
            // Fast local RPC path
            requestUrl = new URL(`instances/${instanceId}`, this.clientData.rpcBaseUrl).href;
        } else {
            // Legacy app frontend path
            const template = this.clientData.managementUrls.purgeHistoryDeleteUri;
            const idPlaceholder = this.clientData.managementUrls.id;
            requestUrl = template.replace(idPlaceholder, instanceId);
        }

        const response = await this.axiosInstance.delete(requestUrl);
        switch (response.status) {
            case 200: // instance found
                return response.data as PurgeHistoryResult;
            case 404: // instance not found
                return new PurgeHistoryResult(0);
            default:
                return Promise.reject(this.createGenericError(response));
        }
    }

    public async purgeInstanceHistoryBy(filter: OrchestrationFilter): Promise<PurgeHistoryResult> {
        let requestUrl: string;
        const { createdTimeFrom, createdTimeTo, runtimeStatus } = filter;
        if (this.clientData.rpcBaseUrl) {
            // Fast local RPC path
            let path = new URL("instances/", this.clientData.rpcBaseUrl).href;
            const query: string[] = [];
            if (createdTimeFrom) {
                query.push(`createdTimeFrom=${createdTimeFrom.toISOString()}`);
            }
            if (createdTimeTo) {
                query.push(`createdTimeTo=${createdTimeTo.toISOString()}`);
            }
            if (runtimeStatus && runtimeStatus.length > 0) {
                const statusList: string = runtimeStatus.map((value) => value.toString()).join(",");
                query.push(`runtimeStatus=${statusList}`);
            }

            if (query.length > 0) {
                path += "?" + query.join("&");
            }

            requestUrl = new URL(path, this.clientData.rpcBaseUrl).href;
        } else {
            // Legacy app frontend path
            const idPlaceholder = this.clientData.managementUrls.id;
            requestUrl = this.clientData.managementUrls.statusQueryGetUri.replace(
                idPlaceholder,
                ""
            );

            if (!(createdTimeFrom instanceof Date)) {
                throw new Error("createdTimeFrom must be a valid Date");
            }

            if (createdTimeFrom) {
                requestUrl += `&${this.createdTimeFromQueryKey}=${createdTimeFrom.toISOString()}`;
            }

            if (createdTimeTo) {
                requestUrl += `&${this.createdTimeToQueryKey}=${createdTimeTo.toISOString()}`;
            }

            if (runtimeStatus && runtimeStatus.length > 0) {
                const statusesString = runtimeStatus
                    .map((value) => value.toString())
                    .reduce((acc, curr, i) => {
                        return acc + (i > 0 ? "," : "") + curr;
                    });

                requestUrl += `&${this.runtimeStatusQueryKey}=${statusesString}`;
            }
        }

        const response = await this.axiosInstance.delete(requestUrl);
        switch (response.status) {
            case 200: // instance found
                return response.data as PurgeHistoryResult;
            case 404: // instance not found
                return new PurgeHistoryResult(0);
            default:
                return Promise.reject(this.createGenericError(response));
        }
    }

    public async raiseEvent(
        instanceId: string,
        eventName: string,
        eventData: unknown,
        options: TaskHubOptions = {}
    ): Promise<void> {
        const { taskHubName, connectionName } = options;
        if (!eventName) {
            throw new Error("eventName must be a valid string.");
        }

        let requestUrl: string;
        if (this.clientData.rpcBaseUrl) {
            // Fast local RPC path
            let path = `instances/${instanceId}/raiseEvent/${eventName}`;
            const query: string[] = [];
            if (taskHubName) {
                query.push(`taskHub=${taskHubName}`);
            }
            if (connectionName) {
                query.push(`connection=${connectionName}`);
            }

            if (query.length > 0) {
                path += "?" + query.join("&");
            }

            requestUrl = new URL(path, this.clientData.rpcBaseUrl).href;
        } else {
            // Legacy app frontend path
            const idPlaceholder = this.clientData.managementUrls.id;
            requestUrl = this.clientData.managementUrls.sendEventPostUri
                .replace(idPlaceholder, instanceId)
                .replace(this.eventNamePlaceholder, eventName);

            if (taskHubName) {
                requestUrl = requestUrl.replace(this.clientData.taskHubName, taskHubName);
            }

            if (connectionName) {
                requestUrl = requestUrl.replace(/(connection=)([\w]+)/gi, "$1" + connectionName);
            }
        }

        const response = await this.axiosInstance.post(requestUrl, JSON.stringify(eventData));
        switch (response.status) {
            case 202: // event accepted
            case 410: // instance completed or failed
                return;
            case 404:
                return Promise.reject(new Error(`No instance with ID '${instanceId}' found.`));
            default:
                return Promise.reject(this.createGenericError(response));
        }
    }

    public async readEntityState<T>(
        entityId: EntityId,
        options: TaskHubOptions = {}
    ): Promise<EntityStateResponse<T>> {
        let requestUrl: string;
        const { taskHubName, connectionName } = options;
        if (this.clientData.rpcBaseUrl) {
            // Fast local RPC path
            let path = `entities/${entityId.name}/${entityId.key}`;
            const query: string[] = [];
            if (taskHubName) {
                query.push(`taskHub=${taskHubName}`);
            }
            if (connectionName) {
                query.push(`connection=${connectionName}`);
            }

            if (query.length > 0) {
                path += "?" + query.join("&");
            }

            requestUrl = new URL(path, this.clientData.rpcBaseUrl).href;
        } else {
            // Legacy app frontend path
            if (!(this.clientData.baseUrl && this.clientData.requiredQueryStringParameters)) {
                throw new Error(
                    "Cannot use the readEntityState API with this version of the Durable Task Extension."
                );
            }

            requestUrl = WebhookUtils.getReadEntityUrl(
                this.clientData.baseUrl,
                this.clientData.requiredQueryStringParameters,
                entityId.name,
                entityId.key,
                taskHubName,
                connectionName
            );
        }

        const response = await this.axiosInstance.get<T>(requestUrl);
        switch (response.status) {
            case 200: // entity exists
                return new EntityStateResponse(true, response.data);
            case 404: // entity does not exist
                return new EntityStateResponse(false);
            default:
                return Promise.reject(this.createGenericError(response));
        }
    }

    public async rewind(
        instanceId: string,
        reason: string,
        options: TaskHubOptions = {}
    ): Promise<void> {
        const { taskHubName, connectionName } = options;
        const idPlaceholder = this.clientData.managementUrls.id;

        let requestUrl: string;
        if (this.clientData.rpcBaseUrl) {
            // Fast local RPC path
            let path = `instances/${instanceId}/rewind?reason=${reason}`;
            const query: string[] = [];
            if (taskHubName) {
                query.push(`taskHub=${taskHubName}`);
            }
            if (connectionName) {
                query.push(`connection=${connectionName}`);
            }

            if (query.length > 0) {
                path += "&" + query.join("&");
            }

            requestUrl = new URL(path, this.clientData.rpcBaseUrl).href;
        } else {
            // Legacy app frontend path
            requestUrl = this.clientData.managementUrls.rewindPostUri
                .replace(idPlaceholder, instanceId)
                .replace(this.reasonPlaceholder, reason);
        }

        const response = await this.axiosInstance.post(requestUrl);
        switch (response.status) {
            case 202:
                return;
            case 404:
                return Promise.reject(new Error(`No instance with ID '${instanceId}' found.`));
            case 410:
                return Promise.reject(
                    new Error(
                        "The rewind operation is only supported on failed orchestration instances."
                    )
                );
            default:
                return Promise.reject(this.createGenericError(response));
        }
    }

    public async signalEntity(
        entityId: EntityId,
        operationName?: string,
        operationContent?: unknown,
        options: TaskHubOptions = {}
    ): Promise<void> {
        const { taskHubName, connectionName } = options;
        let requestUrl: string;
        if (this.clientData.rpcBaseUrl) {
            // Fast local RPC path
            let path = `entities/${entityId.name}/${entityId.key}`;
            const query: string[] = [];
            if (operationName) {
                query.push(`op=${operationName}`);
            }
            if (taskHubName) {
                query.push(`taskHub=${taskHubName}`);
            }
            if (connectionName) {
                query.push(`connection=${connectionName}`);
            }

            if (query.length > 0) {
                path += "?" + query.join("&");
            }

            requestUrl = new URL(path, this.clientData.rpcBaseUrl).href;
        } else {
            // Legacy app frontend path
            if (!(this.clientData.baseUrl && this.clientData.requiredQueryStringParameters)) {
                throw new Error(
                    "Cannot use the signalEntity API with this version of the Durable Task Extension."
                );
            }

            requestUrl = WebhookUtils.getSignalEntityUrl(
                this.clientData.baseUrl,
                this.clientData.requiredQueryStringParameters,
                entityId.name,
                entityId.key,
                operationName,
                taskHubName,
                connectionName
            );
        }

        const response = await this.axiosInstance.post(
            requestUrl,
            JSON.stringify(operationContent)
        );
        switch (response.status) {
            case 202: // signal accepted
                return;
            default:
                return Promise.reject(this.createGenericError(response));
        }
    }

    public async startNew(
        orchestratorFunctionName: string,
        options?: StartNewOptions
    ): Promise<string> {
        if (!orchestratorFunctionName) {
            throw new Error("orchestratorFunctionName must be a valid string.");
        }

        // TODO: Add support for specifying a task hub and a connection name
        let requestUrl: string;
        const instanceIdPath: string = options?.instanceId ? `/${options.instanceId}` : "";
        if (this.clientData.rpcBaseUrl) {
            // Fast local RPC path
            requestUrl = new URL(
                `orchestrators/${orchestratorFunctionName}${instanceIdPath}`,
                this.clientData.rpcBaseUrl
            ).href;
        } else {
            // Legacy app frontend path
            requestUrl = this.clientData.creationUrls.createNewInstancePostUri;
            requestUrl = requestUrl
                .replace(this.functionNamePlaceholder, orchestratorFunctionName)
                .replace(this.instanceIdPlaceholder, instanceIdPath);
        }

        const input: unknown = options?.input !== undefined ? JSON.stringify(options.input) : "";
        const response = await this.axiosInstance.post(requestUrl, input);
        if (response.data && response.status <= 202) {
            return (response.data as HttpManagementPayload).id;
        } else {
            return Promise.reject(this.createGenericError(response));
        }
    }

    public async terminate(instanceId: string, reason: string): Promise<void> {
        const idPlaceholder = this.clientData.managementUrls.id;
        let requestUrl: string;
        if (this.clientData.rpcBaseUrl) {
            // Fast local RPC path
            requestUrl = new URL(
                `instances/${instanceId}/terminate?reason=${reason}`,
                this.clientData.rpcBaseUrl
            ).href;
        } else {
            // Legacy app frontend path
            requestUrl = this.clientData.managementUrls.terminatePostUri
                .replace(idPlaceholder, instanceId)
                .replace(this.reasonPlaceholder, reason);
        }

        const response = await this.axiosInstance.post(requestUrl);
        switch (response.status) {
            case 202: // terminate accepted
            case 410: // instance completed or failed
                return;
            case 404:
                return Promise.reject(new Error(`No instance with ID '${instanceId}' found.`));
            default:
                return Promise.reject(this.createGenericError(response));
        }
    }

    public async waitForCompletionOrCreateCheckStatusResponse(
        request: HttpRequest,
        instanceId: string,
        waitOptions: WaitForCompletionOptions = {}
    ): Promise<HttpResponse> {
        const timeoutInMilliseconds: number =
            waitOptions.timeoutInMilliseconds !== undefined
                ? waitOptions.timeoutInMilliseconds
                : 10000;
        const retryIntervalInMilliseconds: number =
            waitOptions.retryIntervalInMilliseconds !== undefined
                ? waitOptions.retryIntervalInMilliseconds
                : 1000;

        if (retryIntervalInMilliseconds > timeoutInMilliseconds) {
            throw new Error(
                `Total timeout ${timeoutInMilliseconds} (ms) should be bigger than retry timeout ${retryIntervalInMilliseconds} (ms)`
            );
        }

        const hrStart = process.hrtime();
        while (true) {
            const status = await this.getStatus(instanceId);

            if (status) {
                switch (status.runtimeStatus) {
                    case OrchestrationRuntimeStatus.Completed:
                        return this.createHttpResponse(200, status.output);
                    case OrchestrationRuntimeStatus.Canceled:
                    case OrchestrationRuntimeStatus.Terminated:
                        return this.createHttpResponse(200, status);
                    case OrchestrationRuntimeStatus.Failed:
                        return this.createHttpResponse(500, status);
                }
            }

            const hrElapsed = process.hrtime(hrStart);
            const hrElapsedMilliseconds = Utils.getHrMilliseconds(hrElapsed);

            if (hrElapsedMilliseconds < timeoutInMilliseconds) {
                const remainingTime = timeoutInMilliseconds - hrElapsedMilliseconds;
                await Utils.sleep(
                    remainingTime > retryIntervalInMilliseconds
                        ? retryIntervalInMilliseconds
                        : remainingTime
                );
            } else {
                return this.createCheckStatusResponse(request, instanceId);
            }
        }
    }

    private createHttpResponse(statusCode: number, body: unknown): HttpResponse {
        return new HttpResponse({
            status: statusCode,
            jsonBody: body,
            headers: {
                "Content-Type": "application/json",
            },
        });
    }

    private getClientResponseLinks(
        request: HttpRequest | undefined,
        instanceId: string
    ): HttpManagementPayload {
        const payload = { ...this.clientData.managementUrls };

        (Object.keys(payload) as Array<keyof HttpManagementPayload>).forEach((key) => {
            if (
                this.hasValidRequestUrl(request) &&
                isURL(payload[key], this.urlValidationOptions)
            ) {
                const requestUrl = new url.URL((request as HttpRequest).url);
                const dataUrl = new url.URL(payload[key]);
                payload[key] = payload[key].replace(dataUrl.origin, requestUrl.origin);
            }

            payload[key] = payload[key].replace(this.clientData.managementUrls.id, instanceId);
        });

        return payload;
    }

    private hasValidRequestUrl(request: HttpRequest | undefined): boolean {
        return request !== undefined && (request as HttpRequest).url !== undefined;
    }

    private extractUniqueWebhookOrigins(clientData: OrchestrationClientInputData): string[] {
        const origins = this.extractWebhookOrigins(clientData.creationUrls).concat(
            this.extractWebhookOrigins(clientData.managementUrls)
        );

        const uniqueOrigins = origins.reduce<string[]>((acc, curr) => {
            if (acc.indexOf(curr) === -1) {
                acc.push(curr);
            }
            return acc;
        }, []);

        return uniqueOrigins;
    }

    private extractWebhookOrigins(obj: { [key: string]: string }): string[] {
        const origins: string[] = [];

        const keys = Object.getOwnPropertyNames(obj);
        keys.forEach((key) => {
            const value = obj[key];

            if (isURL(value, this.urlValidationOptions)) {
                const valueAsUrl = new url.URL(value);
                const origin = valueAsUrl.origin;
                origins.push(origin);
            }
        });

        return origins;
    }

    /**
     * Internal method that gets the status of all orchestration instances that
     * match the specified conditions. It handles pagination automatically by
     * calling itself recursively until no more continuation tokens are found.
     * @param options Return orchestration instances which were created
     *  after this Date.
     * @param [continuationToken] Continuation token corresponding to the
     * `x-ms-continuation-token` header, for getting the next batch
     * of results. Used for recursion.
     * @param [prevData] Results of a previous request, used internally
     * to aggregate results during recursion.
     */
    private async getStatusInternal(
        options: GetStatusInternalOptions,
        continuationToken?: string,
        prevData?: unknown[]
    ): Promise<AxiosResponse> {
        let requestUrl: string;
        if (this.clientData.rpcBaseUrl) {
            // Fast local RPC path
            let path = new URL(`instances/${options.instanceId || ""}`, this.clientData.rpcBaseUrl)
                .href;
            const query: string[] = [];
            if (options.taskHubName) {
                query.push(`taskHub=${options.taskHubName}`);
            }
            if (options.connectionName) {
                query.push(`connection=${options.connectionName}`);
            }
            if (options.showHistory) {
                query.push(`showHistory=${options.showHistory}`);
            }
            if (options.showHistoryOutput) {
                query.push(`showHistoryOutput=${options.showHistoryOutput}`);
            }
            if (options.showInput) {
                query.push(`showInput=${options.showInput}`);
            }
            if (options.createdTimeFrom) {
                query.push(`createdTimeFrom=${options.createdTimeFrom.toISOString()}`);
            }
            if (options.createdTimeTo) {
                query.push(`createdTimeTo=${options.createdTimeTo.toISOString()}`);
            }
            if (options.runtimeStatus && options.runtimeStatus.length > 0) {
                const statusList: string = options.runtimeStatus
                    .map((value) => value.toString())
                    .join(",");
                query.push(`runtimeStatus=${statusList}`);
            }

            if (query.length > 0) {
                path += "?" + query.join("&");
            }

            requestUrl = new URL(path, this.clientData.rpcBaseUrl).href;
        } else {
            // Legacy app frontend code path
            const template = this.clientData.managementUrls.statusQueryGetUri;
            const idPlaceholder = this.clientData.managementUrls.id;

            requestUrl = template.replace(
                idPlaceholder,
                typeof options.instanceId === "string" ? options.instanceId : ""
            );
            if (options.taskHubName) {
                requestUrl = requestUrl.replace(this.clientData.taskHubName, options.taskHubName);
            }
            if (options.connectionName) {
                requestUrl = requestUrl.replace(
                    /(connection=)([\w]+)/gi,
                    "$1" + options.connectionName
                );
            }
            if (options.showHistory) {
                requestUrl += `&${this.showHistoryQueryKey}=${options.showHistory}`;
            }
            if (options.showHistoryOutput) {
                requestUrl += `&${this.showHistoryOutputQueryKey}=${options.showHistoryOutput}`;
            }
            if (options.createdTimeFrom) {
                requestUrl += `&${
                    this.createdTimeFromQueryKey
                }=${options.createdTimeFrom.toISOString()}`;
            }
            if (options.createdTimeTo) {
                requestUrl += `&${
                    this.createdTimeToQueryKey
                }=${options.createdTimeTo.toISOString()}`;
            }
            if (options.runtimeStatus && options.runtimeStatus.length > 0) {
                const statusesString = options.runtimeStatus
                    .map((value) => value.toString())
                    .reduce((acc, curr, i) => {
                        return acc + (i > 0 ? "," : "") + curr;
                    });

                requestUrl += `&${this.runtimeStatusQueryKey}=${statusesString}`;
            }
            if (typeof options.showInput === "boolean") {
                requestUrl += `&${this.showInputQueryKey}=${options.showInput}`;
            }
        }

        // If a continuation token is provided, we add it to the request's header
        let axiosConfig = undefined;
        if (continuationToken) {
            axiosConfig = {
                headers: {
                    "x-ms-continuation-token": continuationToken,
                },
            };
        }

        // We call the getStatus endpoint and construct a promise callback to handle the recursion
        // This assumes that, so long as continuation tokens are found, that the http response status
        // can be safely ignored (either 200 or 202).
        const response = this.axiosInstance.get(requestUrl, axiosConfig).then((httpResponse) => {
            // Aggregate results so far
            const headers = httpResponse.headers;
            if (prevData) {
                httpResponse.data = prevData.concat(httpResponse.data);
            }
            // If a new continuation token is found, recurse. Otherwise, return the results
            const token = headers["x-ms-continuation-token"];
            if (token) {
                return this.getStatusInternal(options, token, httpResponse.data);
            }
            return httpResponse;
        });

        return response;
    }

    private createGenericError(response: AxiosResponse<any>): Error {
        return new Error(
            `The operation failed with an unexpected status code: ${
                response.status
            }. Details: ${JSON.stringify(response.data)}`
        );
    }
}

interface GetStatusInternalOptions {
    instanceId?: string;
    taskHubName?: string;
    connectionName?: string;
    showHistory?: boolean;
    showHistoryOutput?: boolean;
    createdTimeFrom?: Date;
    createdTimeTo?: Date;
    runtimeStatus?: OrchestrationRuntimeStatus[];
    showInput?: boolean;
}
