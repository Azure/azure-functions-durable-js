import {
    FunctionInput,
    FunctionHandler,
    FunctionOutput,
    FunctionTrigger,
    FunctionOptions,
} from "@azure/functions";
import { IEntityFunctionContext } from "../src/ientityfunctioncontext";
import { IOrchestrationFunctionContext } from "../src/iorchestrationfunctioncontext";
import { ManagedIdentityTokenSource } from "./tokensource";

// orchestrations
export type OrchestrationHandler = (
    context: IOrchestrationFunctionContext
) => Generator<unknown, unknown, any>;

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
    asynchronousPatternEnabled: boolean;
}

// Over time we will likely add more implementations
export type TokenSource = ManagedIdentityTokenSource;

// entities
export type EntityHandler<T> = (context: IEntityFunctionContext<T>) => void;

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
