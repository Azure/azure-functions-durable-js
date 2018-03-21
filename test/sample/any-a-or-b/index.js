const df = require("../../../lib/");

module.exports = df(function*(context){
    context.log("Starting any-a-or-b sample");
    const output = yield Promise.race(context.df.callFunction("A"), context.df.callFunction("B"));
    return output;
});