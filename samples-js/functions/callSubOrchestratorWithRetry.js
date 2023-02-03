const df = require("durable-functions");

const subOrchestratorName = "throwsErrorInLine";

df.app.orchestration("callSubOrchestratorWithRetry", function* (context) {
    const retryOptions = new df.RetryOptions(10000, 2);
    const childId = `${context.df.instanceId}:0`;

    let returnValue;

    try {
        returnValue = yield context.df.callSubOrchestratorWithRetry(
            subOrchestratorName,
            retryOptions,
            "Matter",
            childId
        );
    } catch (e) {
        context.log("Orchestrator caught exception. Sub-orchestrator failed.");
    }

    return returnValue;
});

df.app.orchestration(subOrchestratorName, function* () {
    throw Error(`${subOrchestratorName} does what it says on the tin.`);
});
