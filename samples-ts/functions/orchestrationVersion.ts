import * as df from "durable-functions";
import { ActivityHandler, OrchestrationContext, OrchestrationHandler } from "durable-functions";

const versionedOrchestrator: OrchestrationHandler = function* (context: OrchestrationContext) {
    // context.df.version contains the value of defaultVersion in host.json
    // at the moment when the orchestration was created.
    let activityResult;
    if (context.df.version === "1.0") {
        // Legacy code path
        activityResult = yield context.df.callActivity("ActivityA");
    } else {
        // New code path
        activityResult = yield context.df.callActivity("ActivityB");
    }

    // Provide an opportunity to update and restart the app
    context.df.setCustomStatus("Waiting for Continue event...");
    yield context.df.waitForExternalEvent("Continue");
    context.df.setCustomStatus("Continue event received");

    // New sub-orchestrations will use the current defaultVersion specified in host.json
    const subOrchestratorResult = yield context.df.callSubOrchestrator("versionedSuborchestrator");

    return [
        `Orchestration version: ${context.df.version}`,
        `Suborchestration version: ${subOrchestratorResult}`,
        `Activity result: ${activityResult}`,
    ];
};
df.app.orchestration("versionedOrchestrator", versionedOrchestrator);

const versionedSuborchestrator: OrchestrationHandler = function* (context: OrchestrationContext) {
    return context.df.version;
};
df.app.orchestration("versionedSuborchestrator", versionedSuborchestrator);

const ActivityA: ActivityHandler = (): string => {
    return `Hello from A`;
};
df.app.activity("ActivityA", { handler: ActivityA });

const ActivityB: ActivityHandler = (): string => {
    return `Hello from B`;
};
df.app.activity("ActivityB", { handler: ActivityB });
