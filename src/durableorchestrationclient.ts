// tslint:disable:member-access

import { HttpRequest } from "@azure/functions";
import axios, { AxiosInstance, AxiosResponse } from "axios";
import cloneDeep = require("lodash/cloneDeep");
import process = require("process");
import url = require("url");
import uuid = require("uuid/v1");
import { isURL } from "validator";
import { Constants, DurableOrchestrationStatus, EntityId, EntityStateResponse,
    GetStatusOptions, HttpCreationPayload, HttpManagementPayload,
    IFunctionContext, IHttpRequest, IHttpResponse, OrchestrationClientInputData,
    OrchestrationRuntimeStatus, PurgeHistoryResult, RequestMessage, SchedulerState, Utils,
} from "./classes";

/**
 * Returns an OrchestrationClient instance.
 * @param context The context object of the Azure function whose body
 *  calls this method.
 * @example Get an orchestration client instance
 * ```javascript
 * const df = require("durable-functions");
 *
 * module.exports = async function (context, req) {
 *     const client = df.getClient(context);
 *     const instanceId = await client.startNew(req.params.functionName, undefined, req.body);
 *
 *     return client.createCheckStatusResponse(req, instanceId);
 * };
 * ```
 */
export function getClient(context: unknown): DurableOrchestrationClient {
    let clientData = getClientData(context as IFunctionContext);

    if (!process.env.WEBSITE_HOSTNAME || process.env.WEBSITE_HOSTNAME.includes("0.0.0.0")) {
        clientData = correctClientData(clientData);
    }

    return new DurableOrchestrationClient(clientData);
}

function getClientData(context: IFunctionContext): OrchestrationClientInputData {
    const matchingInstances = Utils.getInstancesOf<OrchestrationClientInputData>(
        (context as IFunctionContext).bindings,
        new OrchestrationClientInputData(undefined, undefined, undefined));

    if (!matchingInstances || matchingInstances.length === 0) {
        throw new Error("An orchestration client function must have an orchestrationClient input binding. Check your function.json definition.");
    }

    return matchingInstances[0];
}

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

        if (isURL(value, {
            protocols: ["http", "https"],
            require_tld: false,
            require_protocol: true,
        })) {
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
    constructor(
        private readonly clientData: OrchestrationClientInputData,
        ) {
        if (!clientData) {
            throw new TypeError(`clientData: Expected OrchestrationClientInputData but got ${typeof clientData}`);
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
    public createCheckStatusResponse(request: IHttpRequest | HttpRequest, instanceId: string): IHttpResponse {
        const httpManagementPayload = this.getClientResponseLinks(request, instanceId);

        return {
            status: 202,
            body: httpManagementPayload,
            headers: {
                "Content-Type": "application/json",
                "Location": httpManagementPayload.statusQueryGetUri,
                "Retry-After": 10,
            },
        };
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
        showInput?: boolean,
        ): Promise<DurableOrchestrationStatus> {

        try {
            const options: GetStatusOptions = {
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
                    return Promise.reject(new Error(`Webhook returned unrecognized status code ${response.status}`));
            }
        } catch (error) {   // error object is axios-specific, not a JavaScript Error; extract relevant bit
            throw error.message;
        }
    }

    /**
     * Gets the status of all orchestration instances.
     */
    public async getStatusAll(): Promise<DurableOrchestrationStatus[]> {
        try {
            const response = await this.getStatusInternal({});
            return response.data as DurableOrchestrationStatus[];
        } catch (error) {   // error object is axios-specific, not a JavaScript Error; extract relevant bit
            throw error.message;
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
        createdTimeFrom: Date,
        createdTimeTo: Date,
        runtimeStatus: OrchestrationRuntimeStatus[],
        ): Promise<DurableOrchestrationStatus[]> {
        try {
            const options: GetStatusOptions = {
                createdTimeFrom,
                createdTimeTo,
                runtimeStatus,
            };
            const response = await this.getStatusInternal(options);

            if (response.status > 202) {
                return Promise.reject(new Error(`Webhook returned status code ${response.status}: ${response.data}`));
            } else {
                return response.data as DurableOrchestrationStatus[];
            }
        } catch (error) {   // error object is axios-specific, not a JavaScript Error; extract relevant bit
            throw error.message;
        }
    }

    /**
     * Purge the history for a concerete instance.
     * @param instanceId The ID of the orchestration instance to purge.
     */
    public async purgeInstanceHistory(instanceId: string): Promise<PurgeHistoryResult> {
        const template = this.clientData.managementUrls.purgeHistoryDeleteUri;
        const idPlaceholder = this.clientData.managementUrls.id;

        const webhookUrl = template.replace(idPlaceholder, instanceId);

        try {
            const response = await this.axiosInstance.delete(webhookUrl);
            switch (response.status) {
                case 200: // instance found
                    return response.data as PurgeHistoryResult;
                case 404: // instance not found
                    return new PurgeHistoryResult(0);
                default:
                    return Promise.reject(new Error(`Webhook returned unrecognized status code ${response.status}`));
            }
        } catch (error) {   // error object is axios-specific, not a JavaScript Error; extract relevant bit
            throw error.message;
        }
    }

    /**
     * Purge the orchestration history for isntances that match the conditions.
     * @param createdTimeFrom Start creation time for querying instances for
     *  purging.
     * @param createdTimeTo End creation time fo rquerying instanes for
     *  purging.
     * @param runtimeStatus List of runtime statuses for querying instances for
     *  purging. Only Completed, Terminated or Failed will be processed.
     */
    public async purgeInstanceHistoryBy(
        createdTimeFrom: Date,
        createdTimeTo?: Date,
        runtimeStatus?: OrchestrationRuntimeStatus[],
        ): Promise<PurgeHistoryResult> {
        const idPlaceholder = this.clientData.managementUrls.id;
        let requestUrl = this.clientData.managementUrls.statusQueryGetUri
        .replace(idPlaceholder, "");

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
                .reduce((acc, curr, i, arr) => {
                    return acc + (i > 0 ? "," : "") + curr;
            });

            requestUrl += `&${this.runtimeStatusQueryKey}=${statusesString}`;
        }

        try {
            const response = await this.axiosInstance.delete(requestUrl);
            switch (response.status) {
                case 200: // instance found
                    return response.data as PurgeHistoryResult;
                case 404: // instance not found
                    return new PurgeHistoryResult(0);
                default:
                    return Promise.reject(new Error(`Webhook returned unrecognized status code ${response.status}`));
            }
        } catch (error) {   // error object is axios-specific, not a JavaScript Error; extract relevant bit
            throw error.message;
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
        connectionName?: string,
        ): Promise<void> {
        if (!eventName) {
            throw new Error("eventName must be a valid string.");
        }

        const idPlaceholder = this.clientData.managementUrls.id;
        let requestUrl = this.clientData.managementUrls.sendEventPostUri
            .replace(idPlaceholder, instanceId)
            .replace(this.eventNamePlaceholder, eventName);

        if (taskHubName) {
            requestUrl = requestUrl.replace(this.clientData.taskHubName, taskHubName);
        }

        if (connectionName) {
            requestUrl = requestUrl.replace(/(connection=)([\w]+)/gi, "$1" + connectionName);
        }

        try {
            const response = await this.axiosInstance.post(requestUrl, JSON.stringify(eventData));
            switch (response.status) {
                case 202: // event accepted
                case 410: // instance completed or failed
                    return;
                case 404:
                    return Promise.reject(new Error(`No instance with ID '${instanceId}' found.`));
                case 400:
                    return Promise.reject(new Error("Only application/json request content is supported"));
                default:
                    return Promise.reject(new Error(`Webhook returned unrecognized status code ${response.status}`));
            }
        } catch (error) {   // error object is axios-specific, not a JavaScript Error; extract relevant bit
            throw error.message;
        }
    }

    public async readEntityState<T>(entityId: EntityId, taskHubName?: string, connectionName?: string): Promise<EntityStateResponse<T>> {
        const instanceId = EntityId.getSchedulerIdFromEntityId(entityId);

        const options: GetStatusOptions = {
            instanceId,
            taskHubName,
            connectionName,
        };

        let status: DurableOrchestrationStatus;
        try {
            const response = await this.getStatusInternal(options);
            status = response.data as DurableOrchestrationStatus;
        } catch (err) {
            throw err.message;
        }
        if (status && status.input) {
            const schedulerState = status.input as SchedulerState;

            if (schedulerState.exists) {
                return new EntityStateResponse(true, JSON.parse(schedulerState.state));
            }
        }

        return new EntityStateResponse(false, undefined);
    }

    /**
     * Rewinds the specified failed orchestration instance with a reason.
     * @param instanceId The ID of the orchestration instance to rewind.
     * @param reason The reason for rewinding the orchestration instance.
     * @returns A promise that resolves when the rewind message is enqueued.
     *
     * This feature is currently in preview.
     */
    public async rewind(instanceId: string, reason: string): Promise<void> {
        const idPlaceholder = this.clientData.managementUrls.id;
        const requestUrl = this.clientData.managementUrls.rewindPostUri
            .replace(idPlaceholder, instanceId)
            .replace(this.reasonPlaceholder, reason);

        try {
            const response = await this.axiosInstance.post(requestUrl);
            switch (response.status) {
                case 202:
                    return;
                case 404:
                    return Promise.reject(new Error(`No instance with ID '${instanceId}' found.`));
                case 410:
                    return Promise.reject(new Error("The rewind operation is only supported on failed orchestration instances."));
                default:
                    return Promise.reject(new Error(`Webhook returned unrecognized status code ${response.status}`));
            }
        } catch (error) {   // error object is axios-specific, not a JavaScript Error; extract relevant bit
            throw error.message;
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
        operationName: string,
        operationContent?: unknown,
        taskHubName?: string,
        connectionName?: string,
        ): Promise<void> {
        Utils.throwIfEmpty(operationName, "operationName");

        const instanceId = EntityId.getSchedulerIdFromEntityId(entityId);
        const request: RequestMessage = {
            id: uuid(),
            op: operationName,
            signal: true,
            arg: operationContent,
        };

        await this.raiseEvent(instanceId, "op", request, taskHubName, connectionName);

        // TODO: end to end tracehelper equivalent?
    }

    /**
     * Starts a new instance of the specified orchestrator function.
     *
     * If an orchestration instance with the specified ID already exists, the
     * existing instance will be silently replaced by this new instance.
     * @param orchestratorFunctionName The name of the orchestrator function to
     *  start.
     * @param instanceId The ID to use for the new orchestration instance. If
     *  no instanceId is specified, the Durable Functions extension will
     *  generate a random GUID (recommended).
     * @param input JSON-serializable input value for the orchestrator
     *  function.
     * @returns The ID of the new orchestration instance.
     */
    public async startNew(orchestratorFunctionName: string, instanceId?: string, input?: unknown): Promise<string> {
        if (!orchestratorFunctionName) {
            throw new Error("orchestratorFunctionName must be a valid string.");
        }

        let requestUrl = this.clientData.creationUrls.createNewInstancePostUri;
        requestUrl = requestUrl
            .replace(this.functionNamePlaceholder, orchestratorFunctionName)
            .replace(this.instanceIdPlaceholder, (instanceId ? `/${instanceId}` : ""));

        try {
            const response = await this.axiosInstance.post(requestUrl, JSON.stringify(input));
            if (response.status > 202) {
                return Promise.reject(new Error(response.data as string));
            } else if (response.data) {
                return (response.data as HttpManagementPayload).id;
            }
        } catch (message) {
            throw new Error(message.error);
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
        const requestUrl = this.clientData.managementUrls.terminatePostUri
            .replace(idPlaceholder, instanceId)
            .replace(this.reasonPlaceholder, reason);

        try {
            const response = await this.axiosInstance.post(requestUrl);
            switch (response.status) {
                case 202: // terminate accepted
                case 410: // instance completed or failed
                    return;
                case 404:
                    return Promise.reject(new Error(`No instance with ID '${instanceId}' found.`));
                default:
                    return Promise.reject(new Error(`Webhook returned unrecognized status code ${response.status}`));
            }
        } catch (error) {   // error object is axios-specific, not a JavaScript Error; extract relevant bit
            throw error.message;
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
        timeoutInMilliseconds: number = 10000,
        retryIntervalInMilliseconds: number = 1000,
        ): Promise<IHttpResponse> {
        if (retryIntervalInMilliseconds > timeoutInMilliseconds) {
            throw new Error(`Total timeout ${timeoutInMilliseconds} (ms) should be bigger than retry timeout ${retryIntervalInMilliseconds} (ms)`);
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
                await Utils.sleep(remainingTime > retryIntervalInMilliseconds
                    ? retryIntervalInMilliseconds
                    : remainingTime);
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

    private getClientResponseLinks(request: IHttpRequest | HttpRequest, instanceId: string): HttpManagementPayload {
        const payload = { ...this.clientData.managementUrls };

        (Object.keys(payload) as Array<(keyof HttpManagementPayload)>).forEach((key) => {
            if (this.hasValidRequestUrl(request) && isURL(payload[key], this.urlValidationOptions)) {
                const requestUrl = new url.URL((request as HttpRequest).url || (request as IHttpRequest).http.url);
                const dataUrl = new url.URL(payload[key]);
                payload[key] = payload[key].replace(dataUrl.origin, requestUrl.origin);
            }

            payload[key] = payload[key].replace(this.clientData.managementUrls.id, instanceId);
        });

        return payload;
    }

    private hasValidRequestUrl(request: IHttpRequest | HttpRequest): boolean {
        const isHttpRequest = request !== undefined && (request as HttpRequest).url !== undefined;
        const isIHttpRequest = request !== undefined && (request as IHttpRequest).http !== undefined;
        return isHttpRequest || isIHttpRequest && (request as IHttpRequest).http.url !== undefined;
    }

    private extractUniqueWebhookOrigins(clientData: OrchestrationClientInputData): string[] {
        const origins = this.extractWebhookOrigins(clientData.creationUrls)
            .concat(this.extractWebhookOrigins(clientData.managementUrls));

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

    private async getStatusInternal(options: GetStatusOptions): Promise<AxiosResponse> {
        const template = this.clientData.managementUrls.statusQueryGetUri;
        const idPlaceholder = this.clientData.managementUrls.id;

        let requestUrl = template.replace(idPlaceholder, typeof(options.instanceId) === "string" ? options.instanceId : "");
        if (options.taskHubName) {
            requestUrl = requestUrl.replace(this.clientData.taskHubName, options.taskHubName);
        }
        if (options.connectionName) {
            requestUrl = requestUrl.replace(/(connection=)([\w]+)/gi, "$1" + options.connectionName);
        }
        if (options.showHistory) {
            requestUrl += `&${this.showHistoryQueryKey}=${options.showHistory}`;
        }
        if (options.showHistoryOutput) {
            requestUrl += `&${this.showHistoryOutputQueryKey}=${options.showHistoryOutput}`;
        }
        if (options.createdTimeFrom) {
            requestUrl += `&${this.createdTimeFromQueryKey}=${options.createdTimeFrom.toISOString()}`;
        }
        if (options.createdTimeTo) {
            requestUrl += `&${this.createdTimeToQueryKey}=${options.createdTimeTo.toISOString()}`;
        }
        if (options.runtimeStatus && options.runtimeStatus.length > 0) {
            const statusesString = options.runtimeStatus
                .map((value) => value.toString())
                .reduce((acc, curr, i, arr) => {
                    return acc + (i > 0 ? "," : "") + curr;
            });

            requestUrl += `&${this.runtimeStatusQueryKey}=${statusesString}`;
        }

        if (typeof options.showInput === "boolean") {
            requestUrl += `&${this.showInputQueryKey}=${options.showInput}`;
        }

        return this.axiosInstance.get(requestUrl);
    }
}
