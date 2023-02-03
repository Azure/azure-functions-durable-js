import * as df from "durable-functions";
import { OrchestrationContext, OrchestrationHandler } from "durable-functions";
import { DateTime } from "luxon";

const continueAsNewCounter: OrchestrationHandler = function* (context: OrchestrationContext) {
    let currentValue: number = context.df.getInput() || 0;
    context.log(`Value is ${currentValue}`);
    currentValue++;

    const wait: DateTime = DateTime.fromJSDate(context.df.currentUtcDateTime).plus({ seconds: 30 });
    context.log("Counting up at" + wait.toString());
    yield context.df.createTimer(wait.toJSDate());

    if (currentValue < 10) {
        context.df.continueAsNew(currentValue);
    }

    return currentValue;
};

df.app.orchestration("continueAsNewCounter", continueAsNewCounter);
