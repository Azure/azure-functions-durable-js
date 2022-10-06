import { InvocationContext, InvocationContextInit, LogHandler } from "@azure/functions";
import {
    DurableOrchestrationBindingInfo,
    DurableOrchestrationContext,
    HistoryEvent,
    HistoryEventOptions,
    OrchestratorStartedEvent,
} from "./classes";
import { IOrchestrationFunctionContext } from "./iorchestrationfunctioncontext";
import { ReplaySchema } from "./replaySchema";
import * as uuidv1 from "uuid/v1";

/**
 * An orchestration context with dummy default values to facilitate mocking/stubbing the
 * Durable Functions API.
 */
export class DummyOrchestrationContext extends InvocationContext
    implements IOrchestrationFunctionContext {
    /**
     * Creates a new instance of a dummy orchestration context.
     * All parameters are optional but are exposed to enable flexibility
     * in the testing process.
     *
     * @param instanceId The instanceId of the orchestration
     * @param history The history events array of the orchestration
     * @param input The input to the orchestration
     * @param currentUtcDateTime The deterministic date at the beginning of orchestration replay
     * @param isReplaying Whether the orchestration is to be marked as isReplaying the its first event
     * @param longRunningTimerIntervalDuration The duration to break smaller timers into if a long timer exceeds the maximum allowed duration
     * @param maximumShortTimerDuration The maximum duration for a timer allowed by the underlying storage infrastructure
     * @param defaultHttpAsyncRequestSleepDurationInMillseconds The default amount of time to wait between sending requests in a callHttp polling scenario
     * @param schemaVersion The schema version currently used after being negotiated with the extension
     * @param parentInstanceId The instanceId of the orchestration's parent, if this is a sub-orchestration
     */
    constructor(
        functionName = "dummyContextFunctionName",
        invocationId: string = uuidv1(),
        logHandler: LogHandler = (_level, ...args) => console.log(...args)
    ) {
        const invocationContextInit: InvocationContextInit = {
            functionName,
            invocationId,
            logHandler,
        };
        super(invocationContextInit);

        // Set this as undefined, let it be initialized by the orchestrator
        this.df = (undefined as unknown) as DurableOrchestrationContext;
    }

    df: DurableOrchestrationContext;
}

export class DurableOrchestrationInput extends DurableOrchestrationBindingInfo {
    constructor(
        instanceId = "",
        history: HistoryEvent[] | undefined = undefined,
        input: any = undefined,
        longRunningTimerIntervalDuration = "3.00:00:00",
        maximumShortTimerDuration = "6.00:00:00",
        defaultHttpAsyncRequestSleepTimeMillseconds = 30000,
        schemaVersion: ReplaySchema = ReplaySchema.V1,
        isReplaying = false,
        parentInstanceId = ""
    ) {
        if (history === undefined) {
            const opts = new HistoryEventOptions(0, new Date());
            history = [new OrchestratorStartedEvent(opts)];
        }

        super(
            history,
            input,
            instanceId,
            isReplaying,
            parentInstanceId,
            maximumShortTimerDuration,
            longRunningTimerIntervalDuration,
            defaultHttpAsyncRequestSleepTimeMillseconds,
            schemaVersion
        );
    }
}
