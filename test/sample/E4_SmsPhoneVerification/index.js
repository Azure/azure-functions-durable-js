const df = require("../../../lib/");
const moment = require('moment');

module.exports = df(function*(context) {
    const phoneNumber = context.df.getInput();
    if (!phoneNumber) {
        throw "A phone number input is required.";
    }

    const challengeCode = yield context.df.callActivityAsync("E4_SendSmsChallenge", phoneNumber);

    const expiration = moment.utc(context.df.currentUtcDateTime).add(90, 's');
    const timeoutTask = context.df.createTimer(expiration.toDate());

    let authorized = false;
    for (let i = 0; i <= 3; i++) {
        const challengeResponseTask = context.df.waitForExternalEvent("SmsChallengeResponse");

        const winner = yield context.df.Task.any([challengeResponseTask, timeoutTask]);

        if (winner === challengeResponseTask) {
            if (challengeResponseTask.result === challengeCode) {
                authorized = true;
                break;
            }
        } else {
            break;
        }
    }

    if (!timeoutTask.isCompleted) {
        timeoutTask.cancel();
    }

    return authorized;
});