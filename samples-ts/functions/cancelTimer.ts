import * as df from "durable-functions";
import { OrchestrationContext, OrchestrationHandler, TimerTask } from "durable-functions";
import { DateTime } from "luxon";

const cancelTimer: OrchestrationHandler = function* (context: OrchestrationContext) {
    const expiration: DateTime = DateTime.fromJSDate(context.df.currentUtcDateTime).plus({
        minutes: 2,
    });
    const timeoutTask: TimerTask = context.df.createTimer(expiration.toJSDate());

    const hello: string = yield context.df.callActivity("sayHello", "from the other side");

    if (!timeoutTask.isCompleted) {
        timeoutTask.cancel();
    }

    return hello;
};
df.app.orchestration("cancelTimer", cancelTimer);
