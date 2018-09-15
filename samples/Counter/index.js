const df = require("../../lib/src");
const moment = require('moment');

module.exports = df.orchestrator(function*(context) {
    let currentValue = context.df.getInput() || 0;
    context.log(`Value is ${currentValue}`);
    currentValue++;

    var wait = moment.utc(context.df.currentUtcDateTime).add(30, 's');
    context.log("Counting up at" + wait.toString());
    yield context.df.createTimer(wait.toDate());

    if (currentValue < 10) {
        yield context.df.continueAsNew(currentValue);
    }

    return currentValue;
});