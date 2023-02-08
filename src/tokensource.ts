import * as types from "./types";

export class ManagedIdentityTokenSource implements types.ManagedIdentityTokenSource {
    /** @hidden */
    public readonly kind: string = "AzureManagedIdentity";

    constructor(public readonly resource: string) {}
}
