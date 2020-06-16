import * as df from "durable-functions";

module.exports = df.orchestrator(function* (context) {
    const entityId = new df.EntityId("CounterEntityTypeScript", "myCounterTS");

    const currentValue = yield context.df.callEntity<number>(entityId, "get");
    if (currentValue < 10) {
        yield context.df.callEntity(entityId, "add", 1);
    }
});
