import { FunctionInput } from "@azure/functions";

export interface DurableClientInput extends FunctionInput {
    type: "durableClient";
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
