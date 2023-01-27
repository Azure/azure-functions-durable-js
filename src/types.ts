import {
    FunctionInput,
    FunctionHandler,
    FunctionOutput,
    FunctionTrigger,
    FunctionOptions,
} from "@azure/functions";
import { IEntityFunctionContext } from "../src/ientityfunctioncontext";
import { IOrchestrationFunctionContext } from "../src/iorchestrationfunctioncontext";
import { DurableOrchestrationClient } from "./durableorchestrationclient";
import { ManagedIdentityTokenSource } from "./tokensource";
import { Task as TaskTask, TimerTask as TimerTaskTask } from "./task";

// orchestrations
export type OrchestrationContext = IOrchestrationFunctionContext;

export type OrchestrationHandler = (
    context: OrchestrationContext
) => Generator<
    Task, // orchestrations yield Task types
    any, // return type of the orchestration
    any // what the SDK passes back to the orchestration
>;

export type Task = TaskTask;
export type TimerTask = TimerTaskTask;

export interface OrchestrationOptions extends Partial<FunctionOptions> {
    handler: OrchestrationHandler;
}

export interface OrchestrationTrigger extends FunctionTrigger {
    type: "orchestrationTrigger";
}

/**
 * Options object provided to `callHttp()` methods on orchestration contexts
 */
export interface CallHttpOptions {
    /**
     * The HTTP request method.
     */
    method: string;
    /**
     * The HTTP request URL.
     */
    url: string;
    /**
     * The HTTP request body.
     */
    body?: string | object;
    /**
     * The HTTP request headers.
     */
    headers?: { [key: string]: string };
    /**
     * The source of the OAuth token to add to the request.
     */
    tokenSource?: TokenSource;
    /**
     * Specifies whether the DurableHttpRequest should handle the asynchronous pattern.
     * @default true
     */
    asynchronousPatternEnabled?: boolean;
}

// Over time we will likely add more implementations
export type TokenSource = ManagedIdentityTokenSource;

// entities
export type EntityContext<T> = IEntityFunctionContext<T>;
export type EntityHandler<T> = (context: EntityContext<T>) => void;

export interface EntityOptions<T> extends Partial<FunctionOptions> {
    handler: EntityHandler<T>;
}

export interface EntityTrigger extends FunctionTrigger {
    type: "entityTrigger";
}

// activities
export type ActivityHandler = FunctionHandler;

export interface ActivityOptions extends Partial<FunctionOptions> {
    handler: ActivityHandler;
    extraInputs?: FunctionInput[];
    extraOutputs?: FunctionOutput[];
}

export interface ActivityTrigger extends FunctionTrigger {
    type: "activityTrigger";
}

// clients
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
export type DurableClient = DurableOrchestrationClient;
