const df = require("durable-functions");
const { DateTime } = require("luxon");

df.app.orchestration("cancelTimer", function* (context) {
    const expiration = DateTime.fromJSDate(context.df.currentUtcDateTime).plus({ minutes: 2 });
    const timeoutTask = context.df.createTimer(expiration.toJSDate());

    const hello = yield context.df.callActivity("sayHello", "from the other side");

    if (!timeoutTask.isCompleted) {
        timeoutTask.cancel();
    }

    return hello;
});
