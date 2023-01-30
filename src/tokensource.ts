import * as types from "./types";

export class ManagedIdentityTokenSource implements types.ManagedIdentityTokenSource {
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
