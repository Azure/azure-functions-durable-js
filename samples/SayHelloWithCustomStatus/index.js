const df = require("../../lib/src");

module.exports = df.orchestrator(function*(context){
    const output = [];

    output.push(yield context.df.callActivity("E1_SayHello", "Tokyo"));
    context.df.setCustomStatus("Tokyo");
    output.push(yield context.df.callActivity("E1_SayHello", "Seattle"));
    context.df.setCustomStatus("Seattle");
    output.push(yield context.df.callActivity("E1_SayHello", "London"));
    context.df.setCustomStatus("London");

    return output;
});