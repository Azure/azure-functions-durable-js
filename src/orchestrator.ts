import * as debug from "debug";
import {
    ContinueAsNewAction,
    DurableOrchestrationBindingInfo,
    EntityId,
    HistoryEvent,
    HistoryEventType,
    IAction,
    IOrchestrationFunctionContext,
    LockState,
    OrchestratorState,
    TaskFilter,
    Utils,
} from "./classes";
import { DurableOrchestrationContext } from "./durableorchestrationcontext";
import { OrchestrationFailureError } from "./orchestrationfailureerror";
import { TaskBase } from "./tasks/taskinterfaces";
import { UpperSchemaVersion } from "./upperSchemaVersion";

/** @hidden */
const log = debug("orchestrator");

/** @hidden */
export class Orchestrator {
    private currentUtcDateTime: Date;

    constructor(public fn: (context: IOrchestrationFunctionContext) => IterableIterator<unknown>) {}

    public listen(): (context: IOrchestrationFunctionContext) => Promise<void> {
        return this.handle.bind(this);
    }

    private async handle(context: IOrchestrationFunctionContext): Promise<void> {
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

        // The upper schema version corresponds to the maximum OOProc protocol version supported by the extension,
        // we use it to determine the format of the SDK's output
        const upperSchemaVersion: UpperSchemaVersion = orchestrationBinding.upperSchemaVersion;
        // const contextLocks: EntityId[] = orchestrationBinding.contextLocks;

        // Initialize currentUtcDateTime
        let decisionStartedEvent: HistoryEvent = Utils.ensureNonNull(
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
                upperSchemaVersion
            );
        }

        // Setup
        const gen = this.fn(context);
        const actions: IAction[][] = [];
        let partialResult: TaskBase;

        try {
            // First execution, we have not yet "yielded" any of the tasks.
            let g = gen.next(undefined);

            while (true) {
                if (!TaskFilter.isYieldable(g.value)) {
                    if (!g.done) {
                        // The orchestrator must have yielded a non-Task related type,
                        // so just return execution flow with what they yielded back.
                        g = gen.next(g.value as any);
                        continue;
                    } else {
                        log("Iterator is done");
                        // The customer returned an absolute type.
                        context.done(
                            undefined,
                            new OrchestratorState({
                                isDone: true,
                                output: g.value,
                                actions,
                                customStatus: context.df.customStatus,
                                schemaVersion: upperSchemaVersion,
                            })
                        );
                        return;
                    }
                }

                partialResult = g.value as TaskBase;
                const newActions = partialResult.yieldNewActions();
                if (newActions && newActions.length > 0) {
                    actions.push(newActions);
                }

                // Return continue as new events as completed, as the execution itself is now completed.
                if (
                    TaskFilter.isSingleTask(partialResult) &&
                    partialResult.action instanceof ContinueAsNewAction
                ) {
                    context.done(
                        undefined,
                        new OrchestratorState({
                            isDone: true,
                            output: undefined,
                            actions,
                            customStatus: context.df.customStatus,
                            schemaVersion: upperSchemaVersion,
                        })
                    );
                    return;
                }

                if (!TaskFilter.isCompletedTask(partialResult)) {
                    context.done(
                        undefined,
                        new OrchestratorState({
                            isDone: false,
                            output: undefined,
                            actions,
                            customStatus: context.df.customStatus,
                            schemaVersion: upperSchemaVersion,
                        })
                    );
                    return;
                }

                const completionIndex = partialResult.completionIndex;

                // The first time a task is marked as complete, the history event that finally marked the task as completed
                // should not yet have been played by the Durable Task framework, resulting in isReplaying being false.
                // On replays, the event will have already been processed by the framework, and IsPlayed will be marked as true.
                if (state[completionIndex] !== undefined) {
                    context.df.isReplaying = state[completionIndex].IsPlayed;
                }

                // Handles the case where an orchestration completes with a return value of a
                // completed (non-faulted) task. This shouldn't generally happen as hopefully the customer
                // would yield the task before returning out of the generator function.
                if (g.done) {
                    log("Iterator is done");
                    context.done(
                        undefined,
                        new OrchestratorState({
                            isDone: true,
                            actions,
                            output: partialResult.result,
                            customStatus: context.df.customStatus,
                            schemaVersion: upperSchemaVersion,
                        })
                    );
                    return;
                }

                // We want to update the `currentUtcDateTime` to be the timestamp of the
                // latest (timestamp-wise) OrchestratorStarted event that occurs (position-wise)
                // before our current completionIndex / our current position in the History.
                const newDecisionStartedEvent = state
                    .filter(
                        (e, index) =>
                            e.EventType === HistoryEventType.OrchestratorStarted &&
                            e.Timestamp > decisionStartedEvent.Timestamp &&
                            index < completionIndex
                    )
                    .pop();

                decisionStartedEvent = newDecisionStartedEvent || decisionStartedEvent;
                context.df.currentUtcDateTime = this.currentUtcDateTime = new Date(
                    decisionStartedEvent.Timestamp
                );

                // The first time a task is marked as complete, the history event that finally marked the task as completed
                // should not yet have been played by the Durable Task framework, resulting in isReplaying being false.
                // On replays, the event will have already been processed by the framework, and IsPlayed will be marked as true.
                if (state[partialResult.completionIndex] !== undefined) {
                    context.df.isReplaying = state[partialResult.completionIndex].IsPlayed;
                }

                if (TaskFilter.isFailedTask(partialResult)) {
                    // We need to check if the generator has a `throw` property merely to satisfy the typechecker.
                    // At this point, it should be guaranteed that the generator has a `throw` and a `next` property,
                    // but we have not refined its type yet.
                    if (!gen.throw) {
                        throw new Error(
                            "Cannot properly throw the exception returned by customer code"
                        );
                    }
                    g = gen.throw(partialResult.exception);
                    continue;
                }

                g = gen.next(partialResult.result as any);
            }
        } catch (error) {
            // Wrap orchestration state in OutOfProcErrorWrapper to ensure data
            // gets embedded in error message received by C# extension.
            const errorState = new OrchestratorState({
                isDone: false,
                output: undefined,
                actions,
                error: error.message,
                customStatus: context.df.customStatus,
                schemaVersion: upperSchemaVersion,
            });
            context.done(new OrchestrationFailureError(error, errorState), undefined);
            return;
        }
    }

    private isLocked(contextLocks: EntityId[]): LockState {
        return new LockState(contextLocks && contextLocks !== null, contextLocks);
    }
    /*
    private lock(
        state: HistoryEvent[],
        instanceId: string,
        contextLocks: EntityId[],
        entities: EntityId[]
    ): DurableLock | undefined {
        if (contextLocks) {
            throw new Error("Cannot acquire more locks when already holding some locks.");
        }

        if (!entities || entities.length === 0) {
            throw new Error("The list of entities to lock must not be null or empty.");
        }

        entities = this.cleanEntities(entities);

        context.df.newGuid(instanceId);

        // All the entities in entities[] need to be locked, but to avoid
        // deadlock, the locks have to be acquired sequentially, in order. So,
        // we send the lock request to the first entity; when the first lock is
        // granted by the first entity, the first entity will forward the lock
        // request to the second entity, and so on; after the last entity
        // grants the last lock, a response is sent back here.

        // send lock request to first entity in the lock set

        return undefined;
    }

    private cleanEntities(entities: EntityId[]): EntityId[] {
        // sort entities
        return entities.sort((a, b) => {
            if (a.key === b.key) {
                if (a.name === b.name) {
                    return 0;
                } else if (a.name < b.name) {
                    return -1;
                } else {
                    return 1;
                }
            } else if (a.key < b.key) {
                return -1;
            } else {
                return 1;
            }
        });

        // TODO: remove duplicates if necessary
    } */
}
