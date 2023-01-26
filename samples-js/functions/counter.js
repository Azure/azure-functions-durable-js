const df = require("durable-functions");

const counterEntityName = "counterEntity";

df.app.entity(counterEntityName, async function (context) {
    await Promise.resolve();
    let currentValue = context.df.getState(() => 0);

    switch (context.df.operationName) {
        case "add":
            const amount = context.df.getInput();
            currentValue += amount;
            break;
        case "reset":
            currentValue = 0;
            break;
        case "get":
            context.df.return(currentValue);
            break;
    }

    context.df.setState(currentValue);
});

df.app.orchestration("counterOrchestration", function* (context) {
    const entityId = new df.EntityId(counterEntityName, "myCounter");

    currentValue = yield context.df.callEntity(entityId, "get");
    if (currentValue < 10) {
        yield context.df.callEntity(entityId, "add", 1);
    }
});
