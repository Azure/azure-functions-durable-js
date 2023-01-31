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
