const df = require("../../../lib/");

module.exports = df(function*(context){
    context.log("Starting orchestration");
    const a = yield context.df.callFunction("foo", 1);
    const b = yield context.df.callFunction("foo", a + 1);
});