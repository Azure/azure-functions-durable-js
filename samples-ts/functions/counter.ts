import * as df from "durable-functions";
import {
    EntityHandler,
    EntityContext,
    OrchestrationContext,
    OrchestrationHandler,
    EntityId,
} from "durable-functions";

const counterEntityName = "counterEntity";

const counterEntity: EntityHandler<number> = async function (
    context: EntityContext<number>
): Promise<void> {
    await Promise.resolve();
    let currentValue: number = context.df.getState(() => 0);

    switch (context.df.operationName) {
        case "add":
            const amount: number = context.df.getInput();
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
};
df.app.entity(counterEntityName, counterEntity);

const counterOrchestration: OrchestrationHandler = function* (context: OrchestrationContext) {
    const entityId: EntityId = new df.EntityId(counterEntityName, "myCounter");

    const currentValue: number = yield context.df.callEntity(entityId, "get");
    if (currentValue < 10) {
        yield context.df.callEntity(entityId, "add", 1);
    }
};
df.app.orchestration("counterOrchestration", counterOrchestration);
