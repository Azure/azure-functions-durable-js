const { output } = require("@azure/functions");
const df = require("durable-functions");
const { DateTime } = require("luxon");

const sendSmsChallengeActivityName = "sendSmsChallenge";

if (process.env.TwilioPhoneNumber && process.env.TwilioAccountSid && process.env.TwilioAuthToken) {
    df.app.orchestration("smsPhoneVerification", function* (context) {
        const phoneNumber = context.df.getInput();
        if (!phoneNumber) {
            throw new Error("A phone number input is required.");
        }

        const challengeCode = yield context.df.callActivity(
            sendSmsChallengeActivityName,
            phoneNumber
        );

        // The user has 90 seconds to respond with the code they received in the SMS message.
        const expiration = DateTime.fromJSDate(context.df.currentUtcDateTime).plus({ hours: 90 });
        const timeoutTask = context.df.createTimer(expiration.toJSDate());

        let authorized = false;
        for (let i = 0; i <= 3; i++) {
            const challengeResponseTask = context.df.waitForExternalEvent("SmsChallengeResponse");

            const winner = yield context.df.Task.any([challengeResponseTask, timeoutTask]);

            if (winner === challengeResponseTask) {
                // We got back a response! Compare it to the challenge code.
                if (challengeResponseTask.result === challengeCode) {
                    authorized = true;
                    break;
                }
            } else {
                // Timeout expired
                break;
            }
        }

        if (!timeoutTask.isCompleted) {
            // All pending timers must be complete or canceled before the function exits.
            timeoutTask.cancel();
        }

        return authorized;
    });

    const twilioOutput = output.generic({
        type: "twilioSms",
        from: "%TwilioPhoneNumber%",
        accountSidSetting: "TwilioAccountSid",
        authTokenSetting: "TwilioAuthToken",
    });

    df.app.activity(sendSmsChallengeActivityName, {
        extraOutputs: [twilioOutput],
        handler: function (phoneNumber, context) {
            // Get a random challenge code
            const challengeCode = Math.floor(Math.random() * 10000);

            context.log(`Sending verification code ${challengeCode} to ${phoneNumber}.`);

            context.extraOutputs.set(twilioOutput, {
                body: `Your verification code is ${challengeCode.toPrecision(4)}`,
                to: phoneNumber,
            });

            return challengeCode;
        },
    });
} else {
    console.warn(
        "Missing Twilio environment variables, skipping registration of functions for smsPhoneVerification orchestration..."
    );
}
