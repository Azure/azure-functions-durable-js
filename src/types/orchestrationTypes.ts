import { FunctionOptions, FunctionTrigger } from "@azure/functions";
import { TokenSource } from ".";
import { IOrchestrationFunctionContext } from "../iorchestrationfunctioncontext";

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
    asynchronousPatternEnabled?: boolean;
}
