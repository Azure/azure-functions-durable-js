const df = require("../../../lib/");

module.exports = df(function*(context){
    context.log("Starting chain sample");
    const output = [];
    output.push(yield context.df.callFunction("hello", "Tokyo"));
    output.push(yield context.df.callFunction("hello", "Seattle"));
    output.push(yield context.df.callFunction("hello", "London"));

    return output;
});