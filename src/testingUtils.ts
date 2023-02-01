import { InvocationContext, InvocationContextInit, LogHandler } from "@azure/functions";
import {
    DurableOrchestrationBindingInfo,
    DurableOrchestrationContext,
    HistoryEvent,
    HistoryEventOptions,
    OrchestratorStartedEvent,
} from "./classes";
import { ReplaySchema } from "./replaySchema";
import * as uuidv1 from "uuid/v1";
import { DurableEntityContext, EntityContext, OrchestrationContext } from "./types";
import * as types from "./types";

export class DummyOrchestrationContext extends InvocationContext
    implements OrchestrationContext, types.DummyOrchestrationContext {
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
    /**
     * Creates a new instance of a dummy orchestration input/trigger value,
     * which is passed to the orchestration on invocation for testing purposes.
     *
     * All parameters are optional but are exposed to enable flexibility
     * in the testing process.
     *
     * @param instanceId The instanceId of the orchestration
     * @param history The history events array of the orchestration
     * @param input The input to the orchestration
     * @param longRunningTimerIntervalDuration The duration to break smaller timers into if a long timer exceeds the maximum allowed duration
     * @param maximumShortTimerDuration The maximum duration for a timer allowed by the underlying storage infrastructure
     * @param defaultHttpAsyncRequestSleepTimeMillseconds The default amount of time to wait between sending requests in a callHttp polling scenario
     * @param schemaVersion The schema version currently used after being negotiated with the extension
     * @param isReplaying Whether the orchestration is to be marked as isReplaying the its first event
     * @param parentInstanceId The instanceId of the orchestration's parent, if this is a sub-orchestration
     */
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

export class DummyEntityContext<T> extends InvocationContext
    implements EntityContext<T>, types.DummyEntityContext<T> {
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

        // Set this as undefined, let it be initialized by the entity
        this.df = (undefined as unknown) as DurableEntityContext<T>;
    }

    df: DurableEntityContext<T>;
}
