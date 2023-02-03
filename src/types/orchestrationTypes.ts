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
     * Specifies whether the Durable extension should continue
     * polling the request after receiving a 202 response.
     *
     * This porperty name replaces the previous `asynchronousPatternEnabled` argument.
     * If both are specified, this property takes precedence.
     *
     * @default true
     */
    enablePolling?: boolean;
    /**
     * Specifies whether the Durable extension should continue
     * polling the request after receiving a 202 response.
     *
     * @deprecated this property name is deprecated.
     * Please use the new `enablePolling` property instead.
     * If both are specified, the `enablePolling` property takes precedence.
     *
     * @default true
     */
    asynchronousPatternEnabled?: boolean;
}
