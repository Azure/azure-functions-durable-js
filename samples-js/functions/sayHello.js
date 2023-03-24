const df = require("durable-functions");

const helloActivityName = "sayHello";

df.app.orchestration("helloSequence", function* (context) {
    context.log("Starting chain sample");

    const output = [];
    output.push(yield context.df.callActivity(helloActivityName, "Tokyo"));
    output.push(yield context.df.callActivity(helloActivityName, "Seattle"));
    output.push(yield context.df.callActivity(helloActivityName, "Cairo"));

    return output;
});

df.app.orchestration("sayHelloWithActivity", function* (context) {
    const input = context.df.getInput();

    const output = yield context.df.callActivity(helloActivityName, input);
    return output;
});

df.app.orchestration("sayHelloWithCustomStatus", function* (context) {
    const input = context.df.getInput();
    const output = yield context.df.callActivity(helloActivityName, input);
    context.df.setCustomStatus(output);
    return output;
});

df.app.orchestration("sayHelloWithSubOrchestrator", function* (context) {
    const input = context.df.getInput();

    const output = yield context.df.callSubOrchestrator("sayHelloWithActivity", input);
    return output;
});

df.app.activity(helloActivityName, {
    handler: function (input) {
        return `Hello ${input}`;
    },
});
