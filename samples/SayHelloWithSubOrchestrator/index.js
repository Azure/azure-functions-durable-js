const df = require("../../lib/src");

module.exports = df(function*(context){
    const input = context.df.getInput();

    const output = yield context.df.callSubOrchestratorAsync("SayHelloWithActivity", input);
    return output;
});