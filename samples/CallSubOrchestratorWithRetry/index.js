const df = require("../../lib/src");

module.exports = df.orchestrator(function*(context){
    const retryOptions = new df.RetryOptions(10000, 2);
    const childId = `${context.df.instanceId}:0`;

    let returnValue;

    try {
        returnValue = yield context.df.callSubOrchestratorWithRetry("ThrowsErrorInline", retryOptions, "Matter", childId);
    } catch (e) {
        context.log("Orchestrator caught exception. Sub-orchestrator failed.");
    }

    return returnValue;
});