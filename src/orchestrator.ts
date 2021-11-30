import {
    DurableOrchestrationBindingInfo,
    HistoryEvent,
    HistoryEventType,
    IOrchestrationFunctionContext,
    Utils,
} from "./classes";
import { DurableOrchestrationContext } from "./durableorchestrationcontext";
import { TaskOrchestrationExecutor } from "./taskorchestrationexecutor";

/** @hidden */
export class Orchestrator {
    private currentUtcDateTime: Date;
    private taskOrchestrationExecutor: TaskOrchestrationExecutor;

    constructor(public fn: (context: IOrchestrationFunctionContext) => IterableIterator<unknown>) {}

    public listen(): (context: IOrchestrationFunctionContext) => Promise<void> {
        return this.handle.bind(this);
    }

    private async handle(context: IOrchestrationFunctionContext): Promise<void> {
        this.taskOrchestrationExecutor = new TaskOrchestrationExecutor();
        const orchestrationBinding = Utils.getInstancesOf<DurableOrchestrationBindingInfo>(
            context.bindings,
            new DurableOrchestrationBindingInfo()
        )[0];

        if (!orchestrationBinding) {
            throw new Error("Could not finding an orchestrationClient binding on context.");
        }

        const state: HistoryEvent[] = orchestrationBinding.history;
        const input = orchestrationBinding.input;
        const instanceId: string = orchestrationBinding.instanceId;
        // const contextLocks: EntityId[] = orchestrationBinding.contextLocks;

        // Initialize currentUtcDateTime
        const decisionStartedEvent: HistoryEvent = Utils.ensureNonNull(
            state.find((e) => e.EventType === HistoryEventType.OrchestratorStarted),
            "The orchestrator can not execute without an OrchestratorStarted event."
        );
        this.currentUtcDateTime = new Date(decisionStartedEvent.Timestamp);

        // Only create durable orchestration context when `context.df` has not been defined
        // if it has been defined, then we must be in some unit-testing scenario
        if (context.df === undefined) {
            // Create durable orchestration context
            context.df = new DurableOrchestrationContext(
                state,
                instanceId,
                this.currentUtcDateTime,
                orchestrationBinding.isReplaying,
                orchestrationBinding.parentInstanceId,
                input,
                this.taskOrchestrationExecutor
            );
        }

        try {
            await this.taskOrchestrationExecutor.execute(context, state, this.fn);
        } catch (error) {
            const b = "";
        }
        return;
    }
}
