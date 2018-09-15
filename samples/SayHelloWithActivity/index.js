const df = require("../../lib/src");

module.exports = df.orchestrator(function*(context){
    const input = context.df.getInput();

    const output = yield context.df.callActivity("E1_SayHello", input);
    return output;
});