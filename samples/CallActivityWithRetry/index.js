const df = require("durable-functions");

module.exports = df.orchestrator(function*(context){
    const retryOptions = new df.RetryOptions(1000, 2);
    let returnValue;

    try {
        returnValue = yield context.df.callActivityWithRetry("FlakyFunction", retryOptions);
    } catch (e) {
        context.log("Orchestrator caught exception. Flaky function is extremely flaky.");
    }

    return returnValue;
});