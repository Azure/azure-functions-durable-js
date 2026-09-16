const { randomBytes } = require("node:crypto");

const baseUrl = (process.env.SAMPLE_BASE_URL || "http://localhost:7071").replace(/\/$/, "");
const expectedTraceId = randomBytes(16).toString("hex");
const parentSpanId = randomBytes(8).toString("hex");
const expectedTraceStateMember = "sample=known";

async function run() {
    const startResponse = await fetch(`${baseUrl}/api/durable-hello`, {
        method: "POST",
        headers: {
            traceparent: `00-${expectedTraceId}-${parentSpanId}-01`,
            tracestate: expectedTraceStateMember,
        },
    });
    if (!startResponse.ok) {
        throw new Error(`Starting the orchestration failed with HTTP ${startResponse.status}.`);
    }

    const start = await startResponse.json();
    if (!start.statusQueryGetUri) {
        throw new Error("The starter response did not include a status query URL.");
    }

    const deadline = Date.now() + 120_000;
    let status;
    do {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        const statusResponse = await fetch(start.statusQueryGetUri);
        if (!statusResponse.ok) {
            throw new Error(
                `Reading orchestration status failed with HTTP ${statusResponse.status}.`
            );
        }
        status = await statusResponse.json();
    } while (
        !["Completed", "Failed", "Terminated"].includes(status.runtimeStatus) &&
        Date.now() < deadline
    );

    if (status.runtimeStatus !== "Completed") {
        throw new Error(`The orchestration ended with status "${status.runtimeStatus}".`);
    }

    assertTraceContext(
        "orchestrator",
        status.output.orchestrationTraceId,
        status.output.orchestrationTraceState
    );

    const expectedGreetings = ["Hello Tokyo!", "Hello Seattle!", "Hello London!"];
    if (JSON.stringify(status.output.greetings) !== JSON.stringify(expectedGreetings)) {
        throw new Error(
            `Unexpected orchestration output: ${JSON.stringify(status.output.greetings)}`
        );
    }

    status.output.activities.forEach((activity, index) => {
        assertTraceContext(
            `activity ${index + 1}`,
            activity.activityTraceId,
            activity.activityTraceState
        );
        assertTraceContext(
            `activity ${index + 1} user span`,
            activity.userSpanTraceId,
            activity.userSpanTraceState
        );
    });

    console.log(
        JSON.stringify(
            {
                instanceId: start.id,
                traceId: expectedTraceId,
                runtimeStatus: status.runtimeStatus,
                greetings: status.output.greetings,
            },
            null,
            2
        )
    );
}

function assertTraceContext(name, traceId, traceState) {
    if (traceId !== expectedTraceId) {
        throw new Error(`${name} used trace ID "${traceId}" instead of "${expectedTraceId}".`);
    }

    const members = traceState.split(",").map((member) => member.trim());
    if (!members.includes(expectedTraceStateMember)) {
        throw new Error(`${name} did not preserve tracestate "${expectedTraceStateMember}".`);
    }
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
