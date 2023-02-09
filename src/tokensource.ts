import * as types from "durable-functions";

export class ManagedIdentityTokenSource implements types.ManagedIdentityTokenSource {
    /** @hidden */
    public readonly kind: string = "AzureManagedIdentity";

    constructor(public readonly resource: string) {}
}
