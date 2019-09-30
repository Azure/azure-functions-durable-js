/**
 * Token Source implementation for [Azure Managed Identities](https://docs.microsoft.com/azure/active-directory/managed-identities-azure-resources/overview).
 */
export interface ManagedIdentityTokenSource {
    /** @hidden */
    kind: "AzureManagedIdentity";

    /**
     * The Azure Active Directory resource identifier of the web API being invoked.
     * For example, `https://management.core.windows.net/` or `https://graph.microsoft.com/`.
     */
    resource: string;
}

// Over time we will likely add more implementations
export type TokenSource = ManagedIdentityTokenSource;

/**
 * Returns a `ManagedIdentityTokenSource` object.
 * @param resource The Azure Active Directory resource identifier of the web API being invoked.
 * @example Gets a `ManagedIdentityTokenSource` object.
 * ```javascript
 * const df = require("durable-functions");
 *
 * module.exports = df.orchestrator(function*(context) {
 *     return yield context.df.callHttp(
 *         "GET",
 *         "https://management.azure.com/subscriptions?api-version=2019-06-01",
 *         null,
 *         df.ManagedIdentityTokenSource("https://management.core.windows.net"));
 * });
 * ```
 */
export function ManagedIdentityTokenSource(resource: string): ManagedIdentityTokenSource {
    return { resource: resource, kind: "AzureManagedIdentity" };
}
