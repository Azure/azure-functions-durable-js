const df = require("durable-functions");
const moment = require("moment");

module.exports = df.orchestrator(function* (context) {
    const expiration = moment.utc(context.df.currentUtcDateTime).add(2, "m");
    const timeoutTask = context.df.createTimer(expiration.toDate());

    const hello = yield context.df.callActivity("E1_SayHello", "from the other side");

    if (!timeoutTask.isCompleted) {
        timeoutTask.cancel();
    }

    return hello;
});
