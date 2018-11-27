import { isURL } from "validator";
import { Constants, DurableOrchestrationStatus, HttpManagementPayload, HttpResponse, IFunctionContext,
    IRequest, OrchestrationClientInputData, OrchestrationRuntimeStatus, Utils, WebhookClient } from "./classes";

export function orchestrationClient(context: unknown): OrchestrationClient {
    return new OrchestrationClient(context);
}

export class OrchestrationClient {
    public taskHubName: string;

    private readonly eventNamePlaceholder = "{eventName}";
    private readonly functionNamePlaceholder = "{functionName}";
    private readonly instanceIdPlaceholder = "[/{instanceId}]";
    private readonly reasonPlaceholder = "{text}";

    private readonly createdTimeFromQueryKey = "createdTimeFrom";
    private readonly createdTimeToQueryKey = "createdTimeTo";
    private readonly runtimeStatusQuerykey = "runtimeStats";
    private readonly showHistoryQueryKey = "showHistory";
    private readonly showHistoryOutputQueryKey = "showHistoryOutput";

    private clientData: OrchestrationClientInputData;
    private webhookClient: WebhookClient;
    private urlValidationOptions: ValidatorJS.IsURLOptions = {
        protocols: ["http", "https"],
        require_tld: false,
        require_protocol: true,
        require_valid_protocol: true,
    };

    constructor(private context: unknown) {
        if (!context) {
            throw new Error("context must have a value.");
        }

        this.clientData = this.getClientData();
        this.taskHubName = this.clientData.taskHubName;
        this.webhookClient = new WebhookClient();
    }

    /**
     * todo
     * @param request todo
     * @param instanceId todo
     */
    public createCheckStatusResponse(request: IRequest, instanceId: string): HttpResponse {
        const httpManagementPayload = this.getClientResponseLinks(request, instanceId);

        return new HttpResponse(
            202,
            httpManagementPayload,
            {
                "Content-Type": "application/json",
                "Location": httpManagementPayload.statusQueryGetUri,
                "Retry-After": 10,
            },
        );
    }

    /**
     * todo
     * @param instanceId todo
     */
    public createHttpManagementPayload(instanceId: string) {
        return this.getClientResponseLinks(undefined, instanceId);
    }

    /**
     * todo
     * @param instanceId todo
     * @param showHistory todo
     * @param showHistoryOutput todo
     */
    public async getStatus(
        instanceId: string,
        showHistory?: boolean,
        showHistoryOutput?: boolean,
        ): Promise<DurableOrchestrationStatus> {
        const template = this.clientData.managementUrls.statusQueryGetUri;
        const idPlacholder = this.clientData.managementUrls.id;

        let webhookUrl = template.replace(idPlacholder, instanceId);
        if (showHistory) {
            webhookUrl += `&${this.showHistoryQueryKey}=${showHistory}`;
        }
        if (showHistoryOutput) {
            webhookUrl += `&${this.showHistoryOutputQueryKey}=${showHistoryOutput}`;
        }

        const res = await this.webhookClient.get(new URL(webhookUrl));
        switch (res.status) {
            case 200: // instance completed
            case 202: // instance in progress
            case 400: // instance failed or terminated
            case 404: // instance not found or pending
            case 500: // instance failed with unhandled exception
                return res.body as DurableOrchestrationStatus;
            default:
                throw new Error(`Webhook returned unrecognized status ${res.status}: ${res.body}`);
        }
    }

    /**
     * todo
     */
    public async getStatusAll(): Promise<DurableOrchestrationStatus[]> {
        // omit instanceId to get status for all instances
        const idPlaceholder = this.clientData.managementUrls.id;
        const url = this.clientData.managementUrls.statusQueryGetUri
            .replace(idPlaceholder, "");

        const res = await this.webhookClient.get(new URL(url));
        return res.body as DurableOrchestrationStatus[];
    }

    /**
     * todo
     * @param createdTimeFrom todo
     * @param createdTimeTo todo
     * @param runtimeStatus todo
     */
    public async getStatusBy(
        createdTimeFrom: Date,
        createdTimeTo: Date,
        runtimeStatus: OrchestrationRuntimeStatus[],
        ): Promise<DurableOrchestrationStatus[]> {
        const idPlaceholder = this.clientData.managementUrls.id;
        let url = this.clientData.managementUrls.statusQueryGetUri
            .replace(idPlaceholder, "");

        if (createdTimeFrom) {
            url += `&${this.createdTimeFromQueryKey}=${createdTimeFrom.toISOString()}`;
        }

        if (createdTimeTo) {
            url += `&${this.createdTimeToQueryKey}=${createdTimeTo.toISOString()}`;
        }

        if (runtimeStatus && runtimeStatus.length > 0) {
            const statusesString = runtimeStatus
                .map((value) => value.toString())
                .reduce((acc, curr, i, arr) => {
                    return acc + (i > 0 ? "," : "") + curr;
            });

            url += `&${this.runtimeStatusQuerykey}=${statusesString}`;
        }

        const res = await this.webhookClient.get(new URL(url));
        if (res.status > 202) {
            throw new Error(`Webhook returned status code ${res.status}: ${res.body}`);
        }   // TODO: Make this better.. message and conditional
        return res.body as DurableOrchestrationStatus[];
    }

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
        let url = this.clientData.managementUrls.sendEventPostUri
            .replace(idPlaceholder, instanceId)
            .replace(this.eventNamePlaceholder, eventName);

        if (taskHubName) {
            url = url.replace(this.clientData.taskHubName, taskHubName);
        }

        if (connectionName) {
            url = url.replace(/(connection=)([\w]+)/gi, "$1" + connectionName);
        }

        const res = await this.webhookClient.post(new URL(url), eventData);
        switch (res.status) {
            case 202: // event acccepted
            case 410: // instance completed or failed
                return;
            case 404:
                throw new Error(`No instance with ID '${instanceId}' found.`);
            case 400:
                throw new Error("Only application/json request content is supported");
            default:
                throw new Error(`Webhook returned unrecognized status code ${res.status}: ${res.body}`);
        }
    }

    /**
     * todo
     * @param instanceId todo
     * @param reason todo
     */
    public async rewind(instanceId: string, reason: string): Promise<void> {
        const idPlaceholder = this.clientData.managementUrls.id;
        const url = this.clientData.managementUrls.rewindPostUri
            .replace(idPlaceholder, instanceId)
            .replace(this.reasonPlaceholder, reason);

        const res = await this.webhookClient.post(new URL(url));
        switch (res.status) {
            case 202:
                return;
            case 404:
                throw new Error(`No instance with ID '${instanceId}' found.`);
            case 410:
                throw new Error(`The rewind operation is only supported on failed orchestration instances.`);
            default:
                throw new Error(`Webhook returned unrecognized status code ${res.status}: ${res.body}`);
        }
    }

    /**
     * todo
     * @param orchestratorFunctionName todo
     * @param instanceId todo
     * @param input todo
     */
    public async startNew(orchestratorFunctionName: string, instanceId?: string, input?: unknown): Promise<string> {
        if (!orchestratorFunctionName) {
            throw new Error("orchestratorFunctionName must be a valid string.");
        }

        let url = this.clientData.creationUrls.createNewInstancePostUri;
        url = url
            .replace(this.functionNamePlaceholder, orchestratorFunctionName)
            .replace(this.instanceIdPlaceholder, (instanceId ? `/${instanceId}` : ""));

        const res = await this.webhookClient.post(new URL(url), input);
        if (res.status > 202) {
            throw new Error(res.body as string);
        } else if (res.body) {
            return (res.body as HttpManagementPayload).id;
        }
    }

    /**
     * todo
     * @param instanceId todo
     * @param reason todo
     */
    public async terminate(instanceId: string, reason: string) {
        const idPlaceholder = this.clientData.managementUrls.id;
        const url = this.clientData.managementUrls.terminatePostUri
            .replace(idPlaceholder, instanceId)
            .replace(this.reasonPlaceholder, reason);

        const res = await this.webhookClient.post(new URL(url));
        switch (res.status) {
            case 202: // terminate accepted
            case 410: // instance completed or failed
                return;
            case 404:
                throw new Error(`No instance with ID '${instanceId}' found.`);
            default:
                throw new Error(`Webhook returned unrecognized status code ${res.status}: ${res.body}`);
        }
    }

    /**
     * todo
     * @param request todo
     * @param instanceId todo
     * @param timeoutInMilliseconds todo
     * @param retryIntervalInMilliseconds todo
     */
    public async waitForCompletionOrCreateCheckStatusResponse(
        request: IRequest,
        instanceId: string,
        timeoutInMilliseconds: number = 10000,
        retryIntervalInMilliseconds: number = 1000,
        ): Promise<HttpResponse> {
        if (retryIntervalInMilliseconds > timeoutInMilliseconds) {
            throw new Error(`Total timeout ${timeoutInMilliseconds} (ms) should be bigger than retry timeout ${retryIntervalInMilliseconds} (ms)`); // tslint:disable-line max-line-length
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

    private createHttpResponse(statusCode: number, body: unknown): HttpResponse {
        const bodyAsJson = JSON.stringify(body);
        return new HttpResponse(
            statusCode,
            bodyAsJson,
            {
                "Content-Type": "application/json",
                "Content-Length": bodyAsJson !== undefined ? bodyAsJson.length : 0,
            },
        );
    }

    private getClientData(): OrchestrationClientInputData {
        const dataKey = (this.context as IFunctionContext).bindings
            ? Object.keys((this.context as IFunctionContext).bindings).filter((val: string) => {
                return Object.keys(new OrchestrationClientInputData(undefined, undefined, undefined)).every((key) => {
                    return (this.context as IFunctionContext).bindings[val].hasOwnProperty(key);
                });
            })[0]
            : undefined;

        if (!dataKey) {
            throw new Error(Constants.OrchestrationClientNoBindingFoundMessage);
        }

        return (this.context as IFunctionContext).bindings[dataKey] as OrchestrationClientInputData;
    }

    private getClientResponseLinks(request: IRequest, instanceId: string): HttpManagementPayload {
        const payload = { ...this.clientData.managementUrls };

        (Object.keys(payload) as Array<(keyof HttpManagementPayload)>).forEach((key) => {
            if (this.hasValidRequestUrl(request) && isURL(payload[key], this.urlValidationOptions)) {
                const requestUrl = new URL(request.url);
                const dataUrl = new URL(payload[key]);
                payload[key] = payload[key].replace(dataUrl.origin, requestUrl.origin);
            }

            payload[key] = payload[key].replace(this.clientData.managementUrls.id, instanceId);
        });

        return payload;
    }

    private hasValidRequestUrl(request: IRequest): boolean {
        if (request && request.url) {
            return true;
        } else {
            return false;
        }
    }
}
