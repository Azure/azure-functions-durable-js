const df = require("../../lib/src");

module.exports = df(function*(context){
    const input = context.df.getInput();

    const output = yield context.df.callActivityAsync("E1_SayHello", input);
    return output;
});