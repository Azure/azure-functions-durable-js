const { app } = require("@azure/functions");
const { context: otelContext, trace } = require("@opentelemetry/api");
const df = require("durable-functions");

const orchestratorName = "helloSequence";
const activityName = "sayHello";
const tracer = trace.getTracer("durable-functions-opentelemetry-sample");

function getActiveSpanContext(functionName) {
    const spanContext = trace.getSpanContext(otelContext.active());
    if (!spanContext || !trace.isSpanContextValid(spanContext)) {
        throw new Error(`${functionName} does not have an active OpenTelemetry context.`);
    }

    return spanContext;
}

function getTraceState(spanContext) {
    return spanContext.traceState?.serialize() ?? "";
}

df.app.activity(activityName, {
    handler: async (name) => {
        const activitySpanContext = getActiveSpanContext(activityName);

        return tracer.startActiveSpan("hello-world.activity.user-span", async (span) => {
            try {
                span.setAttribute("greeting.name", name);
                await new Promise((resolve) => setTimeout(resolve, 10));

                const userSpanContext = getActiveSpanContext("hello-world.activity.user-span");
                if (userSpanContext.spanId !== span.spanContext().spanId) {
                    throw new Error(
                        "The custom activity span did not remain active across asynchronous work."
                    );
                }

                return {
                    greeting: `Hello ${name}!`,
                    activityTraceId: activitySpanContext.traceId,
                    activityTraceState: getTraceState(activitySpanContext),
                    userSpanTraceId: userSpanContext.traceId,
                    userSpanTraceState: getTraceState(userSpanContext),
                };
            } finally {
                span.end();
            }
        });
    },
});

df.app.orchestration(orchestratorName, function* (context) {
    const orchestrationSpanContext = getActiveSpanContext(orchestratorName);
    const activities = [];
    activities.push(yield context.df.callActivity(activityName, "Tokyo"));
    activities.push(yield context.df.callActivity(activityName, "Seattle"));
    activities.push(yield context.df.callActivity(activityName, "London"));

    return {
        orchestrationTraceId: orchestrationSpanContext.traceId,
        orchestrationTraceState: getTraceState(orchestrationSpanContext),
        greetings: activities.map((result) => result.greeting),
        activities,
    };
});

app.http("helloSequenceHttpStart", {
    methods: ["GET", "POST"],
    authLevel: "anonymous",
    route: "durable-hello",
    extraInputs: [df.input.durableClient()],
    handler: async (request, context) => {
        const client = df.getClient(context);
        const instanceId = await client.startNew(orchestratorName);
        return client.createCheckStatusResponse(request, instanceId);
    },
});
