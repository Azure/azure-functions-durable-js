const df = require("durable-functions");

module.exports = df.orchestrator(function* (context) {
    const entityId = new df.EntityId("AsyncCounterEntity", "myAsyncCounter");

    currentValue = yield context.df.callEntity(entityId, "get");
    if (currentValue < 10) {
        yield context.df.callEntity(entityId, "add", 1);
    }
});
