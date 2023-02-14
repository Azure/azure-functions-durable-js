import { InvocationContext, output } from "@azure/functions";
import * as df from "durable-functions";
import { DateTime } from "luxon";
import axios from "axios";
import { ActivityHandler, OrchestrationContext, OrchestrationHandler } from "durable-functions";

const clearWeatherConditions = ["clear sky", "few clouds", "scattered clouds", "broken clouds"];

const getIsClearActivityName = "getIsClear";
const sendGoodWeatherAlertActivityName = "sendGoodWeatherAlert";

interface Location {
    city: string;
    state?: string;
    country: string;
}

interface WeatherMonitorInput {
    location: Location;
    phone: string;
}

interface WeatherApiResponse {
    data: {
        weather: WeatherData[];
    };
}

interface WeatherData {
    description: string;
}

const weatherMonitor: OrchestrationHandler = function* (context: OrchestrationContext) {
    // get input
    const input: WeatherMonitorInput = context.df.getInput();
    context.log(`Received monitor request. Location: ${input.location}. Phone: ${input.phone}`);
    verifyRequest(input);

    // set expiry time to 6 hours from now
    const endTime: DateTime = DateTime.fromJSDate(context.df.currentUtcDateTime).plus({
        hours: 6,
    });
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
        const isClear: boolean = yield context.df.callActivity(
            getIsClearActivityName,
            input.location
        );

        if (isClear) {
            // It's not raining! Or snowing. Or misting. Tell our user to take advantage of it.
            context.log(`Detected clear weather for ${locationString}. Notifying ${input.phone}.`);
            yield context.df.callActivity(sendGoodWeatherAlertActivityName, input.phone);
            break;
        } else {
            // Wait for the next checkpoint
            const nextCheckpoint: DateTime = DateTime.fromJSDate(
                context.df.currentUtcDateTime
            ).plus({
                seconds: 30,
            });

            context.log(`Next check for ${locationString} at ${nextCheckpoint.toString()}`);

            yield context.df.createTimer(nextCheckpoint.toJSDate());
        }
    }

    context.log("Monitor expiring.");
};
df.app.orchestration("weatherMonitor", weatherMonitor);

function verifyRequest(request: any): void {
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

const getIsClearActivity: ActivityHandler = async function (
    location: Location,
    context: InvocationContext
): Promise<boolean> {
    try {
        // get current conditions from OpenWeatherMap API
        const currentConditions = await getCurrentConditions(location);
        // compare against known clear conditions
        return clearWeatherConditions.includes(currentConditions.description);
    } catch (err) {
        context.log(`${getIsClearActivityName} encountered an error: ${err}`);
        throw err;
    }
};
df.app.activity(getIsClearActivityName, {
    handler: getIsClearActivity,
});

async function getCurrentConditions(location: Location): Promise<WeatherData> {
    try {
        // get current conditions from OpenWeatherMap API
        const url = location.state
            ? `https://api.openweathermap.org/data/2.5/weather?q=${location.city},${location.state},${location.country}&appid=${process.env.OpenWeatherMapApiKey}`
            : `https://api.openweathermap.org/data/2.5/weather?q=${location.city},${location.country}&appid=${process.env.OpenWeatherMapApiKey}`;

        const response: WeatherApiResponse = await axios.get(url);
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

const sendGoodWeatherAlertActivity: ActivityHandler = function (
    phoneNumber: string,
    context: InvocationContext
): void {
    // send message to phone number
    context.extraOutputs.set(twilioOutput, {
        body: "The weather's clear outside! Go talk a walk!",
        to: phoneNumber,
    });
};

df.app.activity(sendGoodWeatherAlertActivityName, {
    extraOutputs: [twilioOutput], // register twilio output
    handler: sendGoodWeatherAlertActivity,
});
