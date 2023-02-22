import { FunctionInput, HttpRequest, HttpResponse } from "@azure/functions";
import { EntityId, EntityStateResponse } from "./entity";
import { DurableOrchestrationStatus, OrchestrationRuntimeStatus } from "./orchestration";

export interface DurableClientInput extends FunctionInput {
    type: "durableClient";
}

/**
 * Client for starting, querying, terminating and raising events to
 * orchestration and entity instances.
 */
export declare class DurableClient {
    /**
     * The name of the task hub configured on this orchestration client
     * instance.
     */
    readonly taskHubName: string;

    /** @hidden */
    public readonly uniqueWebhookOrigins: string[];

    /**
     * Creates an HTTP response that is useful for checking the status of the
     * specified instance.
     * @param request The HTTP request that triggered the current orchestration
     *  instance.
     * @param instanceId The ID of the orchestration instance to check.
     * @returns An HTTP 202 response with a Location header and a payload
     *  containing instance management URLs.
     */
    createCheckStatusResponse(request: HttpRequest | undefined, instanceId: string): HttpResponse;

    /**
     * Creates an [[HttpManagementPayload]] object that contains instance
     * management HTTP endpoints.
     * @param instanceId The ID of the orchestration instance to check.
     */
    createHttpManagementPayload(instanceId: string): HttpManagementPayload;

    /**
     * Gets the status of the specified orchestration instance.
     * @param instanceId The ID of the orchestration instance to query.
     * @param showHistory Boolean marker for including execution history in the
     *  response.
     * @param showHistoryOutput Boolean marker for including input and output
     *  in the execution history response.
     */
    getStatus(
        instanceId: string,
        showHistory?: boolean,
        showHistoryOutput?: boolean,
        showInput?: boolean
    ): Promise<DurableOrchestrationStatus>;

    /**
     * Gets the status of all orchestration instances.
     */
    getStatusAll(): Promise<DurableOrchestrationStatus[]>;

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
    getStatusBy(
        createdTimeFrom: Date | undefined,
        createdTimeTo: Date | undefined,
        runtimeStatus: OrchestrationRuntimeStatus[]
    ): Promise<DurableOrchestrationStatus[]>;

    /**
     * Purge the history for a specific orchestration instance.
     * @param instanceId The ID of the orchestration instance to purge.
     */
    purgeInstanceHistory(instanceId: string): Promise<PurgeHistoryResult>;

    /**
     * Purge the orchestration history for instances that match the conditions.
     * @param createdTimeFrom Start creation time for querying instances for
     *  purging.
     * @param createdTimeTo End creation time for querying instances for
     *  purging.
     * @param runtimeStatus List of runtime statuses for querying instances for
     *  purging. Only Completed, Terminated or Failed will be processed.
     */
    purgeInstanceHistoryBy(
        createdTimeFrom: Date,
        createdTimeTo?: Date,
        runtimeStatus?: OrchestrationRuntimeStatus[]
    ): Promise<PurgeHistoryResult>;

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
    raiseEvent(
        instanceId: string,
        eventName: string,
        eventData: unknown,
        taskHubName?: string,
        connectionName?: string
    ): Promise<void>;

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
    readEntityState<T>(
        entityId: EntityId,
        taskHubName?: string,
        connectionName?: string
    ): Promise<EntityStateResponse<T>>;

    /**
     * Rewinds the specified failed orchestration instance with a reason.
     * @param instanceId The ID of the orchestration instance to rewind.
     * @param reason The reason for rewinding the orchestration instance.
     * @returns A promise that resolves when the rewind message is enqueued.
     *
     * This feature is currently in preview.
     */
    rewind(
        instanceId: string,
        reason: string,
        taskHubName?: string,
        connectionName?: string
    ): Promise<void>;

    /**
     * Signals an entity to perform an operation.
     * @param entityId The target entity.
     * @param operationName The name of the operation.
     * @param operationContent The content for the operation.
     * @param taskHubName The TaskHubName of the target entity.
     * @param connectionName The name of the connection string associated with [taskHubName].
     */
    signalEntity(
        entityId: EntityId,
        operationName?: string,
        operationContent?: unknown,
        taskHubName?: string,
        connectionName?: string
    ): Promise<void>;

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
    startNew(orchestratorFunctionName: string, options?: StartNewOptions): Promise<string>;

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
    terminate(instanceId: string, reason: string): Promise<void>;

    /**
     * Creates an HTTP response which either contains a payload of management
     * URLs for a non-completed instance or contains the payload containing
     * the output of the completed orchestration.
     *
     * If the orchestration does not complete within the specified timeout,
     * then the HTTP response will be identical to that of createCheckStatusResponse().
     *
     * @param request The HTTP request that triggered the current function.
     * @param instanceId The unique ID of the instance to check.
     * @param timeoutInMilliseconds Total allowed timeout for output from the
     *  durable function. The default value is 10 seconds.
     * @param retryIntervalInMilliseconds The timeout between checks for output
     *  from the durable function. The default value is 1 second.
     */
    waitForCompletionOrCreateCheckStatusResponse(
        request: HttpRequest,
        instanceId: string,
        timeoutInMilliseconds: number,
        retryIntervalInMilliseconds: number
    ): Promise<HttpResponse>;
}

/**
 * Options object provided as an optional second argument to the `client.startNew()` method
 */
export interface StartNewOptions {
    /**
     *  The ID to use for the new orchestration instance. If
     *  no instanceId is specified, the Durable Functions extension will
     *  generate a random GUID (recommended).
     */
    instanceId?: string;

    /**
     * JSON-serializable input value for the orchestrator function.
     */
    input?: unknown;
}

/**
 * Class to hold statistics about this execution of purge history.
 * The return type of DurableClient.purgeHistory()
 */
export declare class PurgeHistoryResult {
    /**
     * The number of deleted instances.
     */
    readonly instancesDeleted: number;

    /**
     * @param instancesDeleted The number of deleted instances
     */
    constructor(instancesDeleted: number);
}

/**
 * Data structure containing instance management HTTP endpoints.
 */
export declare class HttpManagementPayload {
    /**
     * The ID of the orchestration instance.
     */
    readonly id: string;
    /**
     * The HTTP GET status query endpoint URL.
     */
    readonly statusQueryGetUri: string;
    /**
     * The HTTP POST external event sending endpoint URL.
     */
    readonly sendEventPostUri: string;
    /**
     * The HTTP POST instance termination endpoint URL.
     */
    readonly terminatePostUri: string;
    /**
     * The HTTP POST instance rewind endpoint URL.
     */
    readonly rewindPostUri: string;
    /**
     * The HTTP DELETE purge endpoint URL.
     */
    readonly purgeHistoryDeleteUri: string;
}

/**
 * Options object passed to client `getStatus()` method
 */
export interface GetStatusOptions {
    /**
     * Specifies whether execution history should be included in the response.
     */
    showHistory?: boolean;
    /**
     * Specifies whether input and output should be included in the execution history response.
     */
    showHistoryOutput?: boolean;
    /**
     * Specifies whether orchestration input should be included in the response.
     */
    showInput?: boolean;
}

/**
 * Interface to hold statistics about this execution of purge history.
 * The return type of DurableClient.purgeHistory()
 */
export interface PurgeHistoryResult {
    /**
     * The number of deleted instances.
     */
    readonly instancesDeleted: number;
}

/**
 * Options object passed to DurableClient.raiseEvent()
 */
export interface RaiseEventOptions extends TaskHubOptions {
    /**
     * The ID of the orchestration instance that will handle the event.
     */
    instanceId: string;
    /**
     * The name of the event.
     */
    eventName: string;
    /**
     * The JSON-serializable data associated with the event.
     */
    eventData: unknown;
}

export interface SignalEntityOptions extends TaskHubOptions {
    /**
     * The name of the operation.
     */
    operationName?: string;
    /**
     * The content for the operation
     */
    operationContent?: unknown;
}

/**
 * Options object passed to DurableClient APIs to specify task hub properties
 */
export interface TaskHubOptions {
    /**
     * The TaskHubName of the orchestration
     */
    taskHubName?: string;
    /**
     * The name of the connection string associated with `taskHubName.`
     */
    connectionName?: string;
}
