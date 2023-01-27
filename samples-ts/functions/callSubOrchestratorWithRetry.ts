import * as df from "durable-functions";
import { OrchestrationContext, OrchestrationHandler } from "durable-functions";

const subOrchestratorName = "throwsErrorInLine";

const callSubOrchestratorWithRetry: OrchestrationHandler = function* (
    context: OrchestrationContext
) {
    const retryOptions: df.RetryOptions = new df.RetryOptions(10000, 2);
    const childId = `${context.df.instanceId}:0`;

    let returnValue: any;

    try {
        returnValue = yield context.df.callSubOrchestratorWithRetry(
            subOrchestratorName,
            retryOptions,
            "Input",
            childId
        );
    } catch (e) {
        context.log("Orchestrator caught exception. Sub-orchestrator failed.");
    }

    return returnValue;
};
df.app.orchestration("callSubOrchestratorWithRetry", callSubOrchestratorWithRetry);

const flakyOrchestrator: OrchestrationHandler = function* () {
    throw new Error(`${subOrchestratorName} does what it says on the tin.`);
};
df.app.orchestration(subOrchestratorName, flakyOrchestrator);
