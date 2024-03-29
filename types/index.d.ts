import { InvocationContext } from "@azure/functions";
import { DurableClient } from "./durableClient";

export * from "./activity";
export * from "./durableClient";
export * from "./entity";
export * from "./orchestration";
export * from "./task";

export * as app from "./app";
export * as trigger from "./trigger";
export * as input from "./input";

/**
 * Returns an OrchestrationClient instance.
 * @param context The context object of the Azure function whose body
 *  calls this method.
 *
 */
export function getClient(context: InvocationContext): DurableClient;

/**
 * Token Source implementation for [Azure Managed Identities](https://docs.microsoft.com/azure/active-directory/managed-identities-azure-resources/overview).
 *
 * @example Get a list of Azure Subscriptions by calling the Azure Resource Manager HTTP API.
 * ```javascript
 * const df = require("durable-functions");
 *
 * df.app.orchestration(function* (context) {
 *   return yield context.df.callHttp({
 *       method: "GET",
 *       url: "https://management.azure.com/subscriptions?api-version=2019-06-01",
 *       tokenSource: df.ManagedIdentityTokenSource("https://management.core.windows.net"),
 *   });
 * });
 * ```
 */
export declare class ManagedIdentityTokenSource {
    /**
     * Returns a `ManagedIdentityTokenSource` object.
     * @param resource The Azure Active Directory resource identifier of the web API being invoked.
     */
    constructor(resource: string);

    /**
     * The Azure Active Directory resource identifier of the web API being invoked.
     * For example, `https://management.core.windows.net/` or `https://graph.microsoft.com/`.
     */
    readonly resource: string;
}

// Over time we will likely add more implementations
export type TokenSource = ManagedIdentityTokenSource;

/**
 * Defines retry policies that can be passed as parameters to various
 * operations.
 */
export declare class RetryOptions {
    /**
     * Creates a new instance of RetryOptions with the supplied first retry and
     * max attempts.
     * @param firstRetryIntervalInMilliseconds The first retry interval (ms). Must be greater than 0.
     * @param maxNumberOfAttempts The maximum number of attempts.
     */
    constructor(firstRetryIntervalInMilliseconds: number, maxNumberOfAttempts: number);
    /**
     * The retry backoff coefficient
     */
    backoffCoefficient: number;
    /**
     *  The max retry interval (ms).
     */
    maxRetryIntervalInMilliseconds: number;
    /**
     * The timeout for retries (ms).
     */
    retryTimeoutInMilliseconds: number;
    /**
     * The first retry interval (ms). Must be greater than 0.
     */
    readonly firstRetryIntervalInMilliseconds: number;
    /**
     * The maximum number of attempts.
     */
    readonly maxNumberOfAttempts: number;
}

/**
 * A specfic error thrown when a scheduled activity or suborchestrator has failed.
 * This error can be checked for via `instanceof` guards to catch only exceptions thrown
 * by the DurableJS library.
 */
export declare class DurableError extends Error {
    /**
     * Constructs a `DurableError` instance.
     * @param message error message.
     */
    constructor(message: string | undefined);
}
