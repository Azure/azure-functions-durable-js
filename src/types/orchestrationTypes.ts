import { FunctionOptions, FunctionTrigger, InvocationContext } from "@azure/functions";
import { TokenSource } from ".";
import { DurableOrchestrationContext } from "../classes";

/**
 * Type of a Generator that can be registered as an orchestration
 */
export type OrchestrationHandler = (
    context: OrchestrationContext
) => Generator<unknown, unknown, any>;

/**
 * Context object passed to orchestration Functions.
 */
export interface OrchestrationContext extends InvocationContext {
    /**
     * Object containing all DF orchestration APIs and properties
     */
    df: DurableOrchestrationContext;
}

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
     * Specifies whether to continue polling the request after receiving a 202 response.
     * This replaces `asynchronousPatternEnabled`. If both are specified,
     * `enablePolling` takes precedence.
     *
     * @default true
     */
    enablePolling?: boolean;
    /**
     * @deprecated use `enablePolling` instead. If both are specified,
     * `enablePolling` takes precedence.
     */
    asynchronousPatternEnabled?: boolean;
}

/**
 * The return value of `df.app.orchestration()`
 *
 * This object can be passed to `context.df.callSubOrchestrator()`
 * or `context.df.callSubOrchestratorWithRetry()`.
 */
export interface RegisteredOrchestration {
    /**
     * The name of the SubOrchestrator to call
     */
    name: string;
}
