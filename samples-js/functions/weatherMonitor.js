const { output } = require("@azure/functions");
const df = require("durable-functions");
const { DateTime } = require("luxon");
const axios = require("axios").default;

const clearWeatherConditions = ["clear sky", "few clouds", "scattered clouds", "broken clouds"];

const getIsClearActivity = "getIsClear";
const sendGoodWeatherAlertActivity = "sendGoodWeatherAlert";

if (
    process.env.OpenWeatherMapApiKey &&
    process.env.TwilioPhoneNumber &&
    process.env.TwilioAccountSid &&
    process.env.TwilioAuthToken
) {
    df.app.orchestration("weatherMonitor", function* (context) {
        // get input
        const input = context.df.getInput();
        context.log(`Received monitor request. Location: ${input.location}. Phone: ${input.phone}`);
        verifyRequest(input);

        // set expiry time to 6 hours from now
        const endTime = DateTime.fromJSDate(context.df.currentUtcDateTime).plus({ hours: 6 });
        const locationString = `${input.location.city}${
            input.location.state ? `, ${input.location.state}` : ""
        }, ${input.location.country}`;
        context.log(`Instantiating monitor for ${locationString}. Expires: ${endTime.toString()}.`);

        // until the expiry time
        while (DateTime.fromJSDate(context.df.currentUtcDateTime) < endTime) {
            // Check the weather
            context.log(
                `Checking current weather conditions for ${locationString} at ${context.df.currentUtcDateTime}.`
            );
            const isClear = yield context.df.callActivity(getIsClearActivity, input.location);

            if (isClear) {
                // It's not raining! Or snowing. Or misting. Tell our user to take advantage of it.
                context.log(
                    `Detected clear weather for ${locationString}. Notifying ${input.phone}.`
                );
                yield context.df.callActivity(sendGoodWeatherAlertActivity, input.phone);
                break;
            } else {
                // Wait for the next checkpoint
                const nextCheckpoint = DateTime.fromJSDate(context.df.currentUtcDateTime).plus({
                    seconds: 30,
                });

                context.log(`Next check for ${locationString} at ${nextCheckpoint.toString()}`);

                yield context.df.createTimer(nextCheckpoint.toJSDate());
            }
        }

        context.log("Monitor expiring.");
    });

    function verifyRequest(request) {
        if (!request) {
            throw new Error("An input object is required.");
        }
        if (!request.location) {
            throw new Error("A location input is required.");
        }
        if (!request.location.city) {
            throw new Error("A city is required on the location input.");
        }
        if (!request.location.country) {
            throw new Error("A country code is required on location input.");
        }
        if (
            (request.location.country === "USA" || request.location.country === "US") &&
            !request.location.state
        ) {
            throw new Error("A state code is required on location input for US locations.");
        }
        if (!request.phone) {
            throw new Error("A phone number input is required.");
        }
    }

    df.app.activity(getIsClearActivity, {
        handler: async function (location, context) {
            try {
                // get current conditions from OpenWeatherMap API
                const currentConditions = await getCurrentConditions(location);
                // compare against known clear conditions
                return clearWeatherConditions.includes(currentConditions.description);
            } catch (err) {
                context.log(`${getIsClearActivity} encountered an error: ${err}`);
                throw err;
            }
        },
    });

    async function getCurrentConditions(location) {
        try {
            // get current conditions from OpenWeatherMap API
            const url = location.state
                ? `https://api.openweathermap.org/data/2.5/weather?q=${location.city},${location.state},${location.country}&appid=${process.env.OpenWeatherMapApiKey}`
                : `https://api.openweathermap.org/data/2.5/weather?q=${location.city},${location.country}&appid=${process.env.OpenWeatherMapApiKey}`;

            const response = await axios.get(url);
            return response.data.weather[0];
        } catch (err) {
            throw err;
        }
    }

    // configure twilio output
    const twilioOutput = output.generic({
        type: "twilioSms",
        from: "%TwilioPhoneNumber%",
        accountSidSetting: "TwilioAccountSid",
        authTokenSetting: "TwilioAuthToken",
    });

    df.app.activity(sendGoodWeatherAlertActivity, {
        extraOutputs: [twilioOutput], // register twilio output
        handler: function (phoneNumber, context) {
            // send message to phone number
            context.extraOutputs.set(twilioOutput, {
                body: "The weather's clear outside! Go talk a walk!",
                to: phoneNumber,
            });
        },
    });
} else {
    console.warn(
        "Missing API keys/environment variables, skipping registration of functions for weatherMonitor orchestration..."
    );
}
