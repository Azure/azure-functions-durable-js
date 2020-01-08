const df = require("durable-functions");

module.exports = df.orchestrator(function*(context) {
    // More information on the use of managed identities in the callHttp API:
    // https://docs.microsoft.com/azure/azure-functions/durable/durable-functions-http-features#managed-identities
    var res = yield context.df.callHttp(
        "GET",
        "https://management.azure.com/subscriptions?api-version=2019-06-01",
        undefined,
        undefined,
        new df.ManagedIdentityTokenSource("https://management.core.windows.net"));
    return res;
});
