/**
 * Token Source implementation for [Azure Managed Identities](https://docs.microsoft.com/azure/active-directory/managed-identities-azure-resources/overview).
 *
 * @example Get a list of Azure Subscriptions by calling the Azure Resource Manager HTTP API.
 * ```javascript
 * const df = require("durable-functions");
 *
 * module.exports = df.orchestrator(function*(context) {
 *     return yield context.df.callHttp(
 *         "GET",
 *         "https://management.azure.com/subscriptions?api-version=2019-06-01",
 *         undefined,
 *         undefined,
 *         df.ManagedIdentityTokenSource("https://management.core.windows.net"));
 * });
 * ```
 */
export class ManagedIdentityTokenSource {
    /** @hidden */
    public readonly kind: string = "AzureManagedIdentity";

    /**
     * Returns a `ManagedIdentityTokenSource` object.
     * @param resource The Azure Active Directory resource identifier of the web API being invoked.
     */
    constructor(
        /**
         * The Azure Active Directory resource identifier of the web API being invoked.
         * For example, `https://management.core.windows.net/` or `https://graph.microsoft.com/`.
         */
        public readonly resource: string
    ) {}
}

// Over time we will likely add more implementations
export type TokenSource = ManagedIdentityTokenSource;
