// tslint:disable:member-access

import { FunctionInput, HttpRequest, HttpResponse, InvocationContext } from "@azure/functions";
import axios, { AxiosInstance, AxiosResponse } from "axios";
/** @hidden */
import cloneDeep = require("lodash/cloneDeep");
/** @hidden */
import process = require("process");
/** @hidden */
import url = require("url");
import { isURL } from "validator";
import {
    Constants,
    DurableOrchestrationStatus,
    EntityId,
    EntityStateResponse,
    HttpCreationPayload,
    HttpManagementPayload,
    IHttpRequest,
    IHttpResponse,
    OrchestrationClientInputData,
    PurgeHistoryResult,
    Utils,
} from "./classes";
import { StartNewOptions, DurableClientInput, OrchestrationRuntimeStatus } from "./types";
import { WebhookUtils } from "./webhookutils";

/** @hidden */
const URL = url.URL;

/**
 * Returns an OrchestrationClient instance.
 * @param context The context object of the Azure function whose body
 *  calls this method.
 *
 */
export function getClient(context: InvocationContext): DurableOrchestrationClient {
    const foundInput: FunctionInput | undefined = context.options.extraInputs.find(
        isDurableClientInput
    );
    if (!foundInput) {
        throw new Error(
            "Could not find a registered durable client input binding. Check your extraInputs definition when registering your function."
        );
    }

    const clientInputOptions = foundInput as DurableClientInput;
    let clientData = getClientData(context, clientInputOptions);

    if (!process.env.WEBSITE_HOSTNAME || process.env.WEBSITE_HOSTNAME.includes("0.0.0.0")) {
        clientData = correctClientData(clientData);
    }

    return new DurableOrchestrationClient(clientData);
}

/** @hidden */
function isDurableClientInput(input: FunctionInput): boolean {
    return input.type === "durableClient" || input.type === "orchestrationClient";
}

/** @hidden */
function getClientData(
    context: InvocationContext,
    clientInput: DurableClientInput
): OrchestrationClientInputData {
    const clientData: unknown = context.extraInputs.get(clientInput);
    if (clientData && OrchestrationClientInputData.isOrchestrationClientInputData(clientData)) {
        return clientData as OrchestrationClientInputData;
    }

    throw new Error(
        "Received input is not a valid durable client input. Check your extraInputs definition when registering your function."
    );
}

/** @hidden */
function correctClientData(clientData: OrchestrationClientInputData): OrchestrationClientInputData {
    const returnValue = cloneDeep(clientData);

    returnValue.creationUrls = correctUrls(clientData.creationUrls) as HttpCreationPayload;
    returnValue.managementUrls = correctUrls(clientData.managementUrls) as HttpManagementPayload;

    return returnValue;
}

function correctUrls(obj: { [key: string]: string }): { [key: string]: string } {
    const returnValue = cloneDeep(obj);

    const keys = Object.getOwnPropertyNames(obj);
    keys.forEach((key) => {
        const value = obj[key];

        if (
            isURL(value, {
                protocols: ["http", "https"],
                require_tld: false,
                require_protocol: true,
            })
        ) {
            const valueAsUrl = new url.URL(value);
            returnValue[key] = value.replace(valueAsUrl.origin, Constants.DefaultLocalOrigin);
        }
    });

    return returnValue;
}

/**
 * Client for starting, querying, terminating and raising events to
 * orchestration instances.
 */
export class DurableOrchestrationClient {
    /**
     * The name of the task hub configured on this orchestration client
     * instance.
     */
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

    /**
     * Creates an HTTP response that is useful for checking the status of the
     * specified instance.
     * @param request The HTTP request that triggered the current orchestration
     *  instance.
     * @param instanceId The ID of the orchestration instance to check.
     * @returns An HTTP 202 response with a Location header and a payload
     *  containing instance management URLs.
     */
    public createCheckStatusResponse(
        request: IHttpRequest | HttpRequest | undefined,
        instanceId: string
    ): HttpResponse {
        const httpManagementPayload = this.getClientResponseLinks(request, instanceId);

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

    /**
     * Creates an [[HttpManagementPayload]] object that contains instance
     * management HTTP endpoints.
     * @param instanceId The ID of the orchestration instance to check.
     */
    public createHttpManagementPayload(instanceId: string): HttpManagementPayload {
        return this.getClientResponseLinks(undefined, instanceId);
    }

    /**
     * Gets the status of the specified orchestration instance.
     * @param instanceId The ID of the orchestration instance to query.
     * @param showHistory Boolean marker for including execution history in the
     *  response.
     * @param showHistoryOutput Boolean marker for including input and output
     *  in the execution history response.
     */
    public async getStatus(
        instanceId: string,
        showHistory?: boolean,
        showHistoryOutput?: boolean,
        showInput?: boolean
    ): Promise<DurableOrchestrationStatus> {
        const options: GetStatusInternalOptions = {
            instanceId,
            showHistory,
            showHistoryOutput,
            showInput,
        };
        const response = await this.getStatusInternal(options);

        switch (response.status) {
            case 200: // instance completed
            case 202: // instance in progress
            case 400: // instance failed or terminated
            case 404: // instance not found or pending
            case 500: // instance failed with unhandled exception
                return response.data as DurableOrchestrationStatus;
            default:
                return Promise.reject(this.createGenericError(response));
        }
    }

    /**
     * Gets the status of all orchestration instances.
     */
    public async getStatusAll(): Promise<DurableOrchestrationStatus[]> {
        const response = await this.getStatusInternal({});
        switch (response.status) {
            case 200:
                return response.data as DurableOrchestrationStatus[];
            default:
                return Promise.reject(this.createGenericError(response));
        }
    }

    /**
     * Gets the status of all orchestration instances that match the specified
     * conditions.
     * @param createdTimeFrom Return orchestration instances which were created
     *  after this Date.
     * @param createdTimeTo Return orchestration instances which were created
     *  before this DateTime.
     * @param runtimeStatus Return orchestration instances which match any of
     *  the runtimeStatus values in this array.
     */
    public async getStatusBy(
        createdTimeFrom: Date | undefined,
        createdTimeTo: Date | undefined,
        runtimeStatus: OrchestrationRuntimeStatus[]
    ): Promise<DurableOrchestrationStatus[]> {
        const options: GetStatusInternalOptions = {
            createdTimeFrom,
            createdTimeTo,
            runtimeStatus,
        };

        const response = await this.getStatusInternal(options);
        switch (response.status) {
            case 200:
                return response.data as DurableOrchestrationStatus[];
            default:
                return Promise.reject(this.createGenericError(response));
        }
    }

    /**
     * Purge the history for a specific orchestration instance.
     * @param instanceId The ID of the orchestration instance to purge.
     */
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

    /**
     * Purge the orchestration history for instances that match the conditions.
     * @param createdTimeFrom Start creation time for querying instances for
     *  purging.
     * @param createdTimeTo End creation time for querying instances for
     *  purging.
     * @param runtimeStatus List of runtime statuses for querying instances for
     *  purging. Only Completed, Terminated or Failed will be processed.
     */
    public async purgeInstanceHistoryBy(
        createdTimeFrom: Date,
        createdTimeTo?: Date,
        runtimeStatus?: OrchestrationRuntimeStatus[]
    ): Promise<PurgeHistoryResult> {
        let requestUrl: string;
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

    /**
     * Sends an event notification message to a waiting orchestration instance.
     * @param instanceId The ID of the orchestration instance that will handle
     *  the event.
     * @param eventName The name of the event.
     * @param eventData The JSON-serializable data associated with the event.
     * @param taskHubName The TaskHubName of the orchestration that will handle
     *  the event.
     * @param connectionName The name of the connection string associated with
     *  `taskHubName.`
     * @returns A promise that resolves when the event notification message has
     *  been enqueued.
     *
     * In order to handle the event, the target orchestration instance must be
     * waiting for an event named `eventName` using
     * [[waitForExternalEvent]].
     *
     * If the specified instance is not found or not running, this operation
     * will have no effect.
     */
    public async raiseEvent(
        instanceId: string,
        eventName: string,
        eventData: unknown,
        taskHubName?: string,
        connectionName?: string
    ): Promise<void> {
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

    /**
     * Tries to read the current state of an entity. Returnes undefined if the
     * entity does not exist, or if the JSON-serialized state of the entity is
     * larger than 16KB.
     * @param T The JSON-serializable type of the entity.
     * @param entityId The target entity.
     * @param taskHubName The TaskHubName of the target entity.
     * @param connectionName The name of the connection string associated with
     * [taskHubName].
     * @returns A response containing the current state of the entity.
     */
    public async readEntityState<T>(
        entityId: EntityId,
        taskHubName?: string,
        connectionName?: string
    ): Promise<EntityStateResponse<T>> {
        let requestUrl: string;
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

    /**
     * Rewinds the specified failed orchestration instance with a reason.
     * @param instanceId The ID of the orchestration instance to rewind.
     * @param reason The reason for rewinding the orchestration instance.
     * @returns A promise that resolves when the rewind message is enqueued.
     *
     * This feature is currently in preview.
     */
    public async rewind(
        instanceId: string,
        reason: string,
        taskHubName?: string,
        connectionName?: string
    ): Promise<void> {
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

    /**
     * Signals an entity to perform an operation.
     * @param entityId The target entity.
     * @param operationName The name of the operation.
     * @param operationContent The content for the operation.
     * @param taskHubName The TaskHubName of the target entity.
     * @param connectionName The name of the connection string associated with [taskHubName].
     */
    public async signalEntity(
        entityId: EntityId,
        operationName?: string,
        operationContent?: unknown,
        taskHubName?: string,
        connectionName?: string
    ): Promise<void> {
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

    /**
     * Starts a new instance of the specified orchestrator function.
     *
     * If an orchestration instance with the specified ID already exists, the
     * existing instance will be silently replaced by this new instance.
     * @param orchestratorFunctionName The name of the orchestrator function to
     *  start.
     * @param options optional object to control the scheduled orchestrator (e.g provide input, instanceID)
     * @returns The ID of the new orchestration instance.
     */
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

    /**
     * Terminates a running orchestration instance.
     * @param instanceId The ID of the orchestration instance to terminate.
     * @param reason The reason for terminating the orchestration instance.
     * @returns A promise that resolves when the terminate message is enqueued.
     *
     * Terminating an orchestration instance has no effect on any in-flight
     * activity function executions or sub-orchestrations that were started
     * by the current orchestration instance.
     */
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

    /**
     * Creates an HTTP response which either contains a payload of management
     * URLs for a non-completed instance or contains the payload containing
     * the output of the completed orchestration.
     *
     * If the orchestration does not complete within the specified timeout,
     * then the HTTP response will be identical to that of
     * [[createCheckStatusResponse]].
     *
     * @param request The HTTP request that triggered the current function.
     * @param instanceId The unique ID of the instance to check.
     * @param timeoutInMilliseconds Total allowed timeout for output from the
     *  durable function. The default value is 10 seconds.
     * @param retryIntervalInMilliseconds The timeout between checks for output
     *  from the durable function. The default value is 1 second.
     */
    public async waitForCompletionOrCreateCheckStatusResponse(
        request: HttpRequest,
        instanceId: string,
        timeoutInMilliseconds = 10000,
        retryIntervalInMilliseconds = 1000
    ): Promise<IHttpResponse> {
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

    private createHttpResponse(statusCode: number, body: unknown): IHttpResponse {
        const bodyAsJson = JSON.stringify(body);
        return {
            status: statusCode,
            body: bodyAsJson,
            headers: {
                "Content-Type": "application/json",
            },
        };
    }

    private getClientResponseLinks(
        request: IHttpRequest | HttpRequest | undefined,
        instanceId: string
    ): HttpManagementPayload {
        const payload = { ...this.clientData.managementUrls };

        (Object.keys(payload) as Array<keyof HttpManagementPayload>).forEach((key) => {
            if (
                this.hasValidRequestUrl(request) &&
                isURL(payload[key], this.urlValidationOptions)
            ) {
                const requestUrl = new url.URL(
                    (request as HttpRequest).url || (request as IHttpRequest).http.url
                );
                const dataUrl = new url.URL(payload[key]);
                payload[key] = payload[key].replace(dataUrl.origin, requestUrl.origin);
            }

            payload[key] = payload[key].replace(this.clientData.managementUrls.id, instanceId);
        });

        return payload;
    }

    private hasValidRequestUrl(request: IHttpRequest | HttpRequest | undefined): boolean {
        const isHttpRequest = request !== undefined && (request as HttpRequest).url !== undefined;
        const isIHttpRequest =
            request !== undefined && (request as IHttpRequest).http !== undefined;
        return (
            isHttpRequest || (isIHttpRequest && (request as IHttpRequest).http.url !== undefined)
        );
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
