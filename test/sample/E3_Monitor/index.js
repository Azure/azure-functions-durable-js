const df = require("../../../lib/");
const moment = require('moment');

module.exports = df(function*(context) {
    const input = context.df.getInput();
    context.log("Received monitor request. Location: " + (input ? input.Location : undefined)
        + ". Phone: " + (input ? input.Phone : undefined) + ".");

    verifyRequest(input);

    const endTime = moment.utc(context.df.currentUtcDateTime).add(6, 'h');
    context.log("Instantiating monitor for " + input.Location.City + ", " + input.Location.State
        + ". Expires: " + (endTime) + "."); // tostring in JavaScript?

    while (moment.utc(context.df.currentUtcDateTime).isBefore(endTime)) {
        // Check the weather
        context.log("Checking current weather conditions for " + input.Location.City + ", "
            + input.Location.State + " at " + context.df.currentUtcDateTime + ".");

        const isClear = yield context.df.callActivityAsync("E3_GetIsClear", input.Location);

        if (isClear) {
            // It's not raining! Or snowing. Or misting. Tell our user to take advantage of it.
            context.log("Detected clear weather for " + input.Location.City + ", "
                + input.Location.State + ". Notifying " + input.Phone + ".");

                yield context.df.callActivityAsync("E3_SendGoodWeatherAlert", input.Phone);
                break;
        } else {
            // Wait for the next checkpoint
            var nextCheckpoint = moment.utc(context.df.currentUtcDateTime).add(30, 's');
            context.log("Next check for " + input.Location.City + ", " + input.Location.State
                + " at " + nextCheckpoint.toString());

            yield context.df.createTimer(nextCheckpoint.toDate());   // accomodate cancellation tokens
        }
    }

    context.log("Monitor expiring.");
});

function verifyRequest(request) {
    if (!request) {
        throw new Error("An input object is required.");
    }
    if (!request.Location) {
        throw new Error("A location input is required.");
    }
    if (!request.Phone) {
        throw new Error("A phone number input is required.");
    }
}