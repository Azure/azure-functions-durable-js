const df = require("durable-functions");

df.app.orchestration("callActivityWithRetry", function* (context) {
    const retryOptions = new df.RetryOptions(1000, 2);
    let returnValue;

    try {
        returnValue = yield context.df.callActivityWithRetry("flakyFunction", retryOptions);
    } catch (e) {
        context.log("Orchestrator caught exception. Flaky function is extremely flaky.");
    }

    return returnValue;
});

df.app.activity("flakyFunction", {
    handler: function (_input, context) {
        context.log("Flaky Function Flaking!");
        throw Error("FlakyFunction flaked");
    },
});
