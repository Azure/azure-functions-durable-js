import { InvocationContext, output } from "@azure/functions";
import * as df from "durable-functions";
import {
    ActivityHandler,
    OrchestrationContext,
    OrchestrationHandler,
    Task,
    TimerTask,
} from "durable-functions";
import { DateTime } from "luxon";

const sendSmsChallengeActivityName = "sendSmsChallenge";

const smsPhoneVerification: OrchestrationHandler = function* (context: OrchestrationContext) {
    const phoneNumber: string = context.df.getInput();
    if (!phoneNumber) {
        throw new Error("A phone number input is required.");
    }

    const challengeCode: number = yield context.df.callActivity(
        sendSmsChallengeActivityName,
        phoneNumber
    );

    // The user has 90 seconds to respond with the code they received in the SMS message.
    const expiration: DateTime = DateTime.fromJSDate(context.df.currentUtcDateTime).plus({
        seconds: 90,
    });
    const timeoutTask: TimerTask = context.df.createTimer(expiration.toJSDate());

    let authorized = false;
    for (let i = 0; i <= 3; i++) {
        const challengeResponseTask: Task = context.df.waitForExternalEvent("SmsChallengeResponse");

        const winner: Task = yield context.df.Task.any([challengeResponseTask, timeoutTask]);

        if (winner === timeoutTask) {
            // Timeout expired
            break;
        }

        // We got back a response! Compare it to the challenge code.
        if (challengeResponseTask.result === challengeCode) {
            authorized = true;
            break;
        }
    }

    if (!timeoutTask.isCompleted) {
        // All pending timers must be complete or canceled before the function exits.
        timeoutTask.cancel();
    }

    return authorized;
};
df.app.orchestration("smsPhoneVerification", smsPhoneVerification);

const twilioOutput = output.generic({
    type: "twilioSms",
    from: "%TwilioPhoneNumber%",
    accountSidSetting: "TwilioAccountSid",
    authTokenSetting: "TwilioAuthToken",
});

const sendSmsChallenge: ActivityHandler = function (
    phoneNumber: string,
    context: InvocationContext
): number {
    // Get a random challenge code
    const challengeCode: number = Math.floor(Math.random() * 10000);

    context.log(`Sending verification code ${challengeCode} to ${phoneNumber}.`);

    context.extraOutputs.set(twilioOutput, {
        body: `Your verification code is ${challengeCode.toPrecision(4)}`,
        to: phoneNumber,
    });

    return challengeCode;
};

df.app.activity(sendSmsChallengeActivityName, {
    extraOutputs: [twilioOutput],
    handler: sendSmsChallenge,
});
