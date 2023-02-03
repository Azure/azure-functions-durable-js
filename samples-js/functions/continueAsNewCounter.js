const df = require("durable-functions");
const { DateTime } = require("luxon");

df.app.orchestration("continueAsNewCounter", function* (context) {
    let currentValue = context.df.getInput() || 0;
    context.log(`Value is ${currentValue}`);
    currentValue++;

    const wait = DateTime.fromJSDate(context.df.currentUtcDateTime).plus({ seconds: 30 });
    context.log("Counting up at" + wait.toString());
    yield context.df.createTimer(wait.toJSDate());

    if (currentValue < 10) {
        context.df.continueAsNew(currentValue);
    }

    return currentValue;
});
