import { FunctionOptions, FunctionTrigger, InvocationContext } from "@azure/functions";
import { Task, TokenSource } from ".";
import { DurableOrchestrationContext } from "../classes";

/**
 * Type of a Generator that can be registered as an orchestration
 * @param TReturn the type of the return value of the orchestration
 */
export type OrchestrationHandler<TReturn = any> = (
    context: OrchestrationContext
) => Generator<
    Task, // orchestrations can only yield Task types
    TReturn, // return type of the orchestration
    any // what the SDK passes back to the orchestration
>;

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
     * Specifies whether the DurableHttpRequest should handle the asynchronous pattern.
     * @default true
     */
    asynchronousPatternEnabled?: boolean;
}
