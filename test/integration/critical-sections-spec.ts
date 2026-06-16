import { expect } from "chai";
import "mocha";
import { DurableOrchestrationContext } from "../../src/orchestrations/DurableOrchestrationContext";
import { TaskOrchestrationExecutor } from "../../src/orchestrations/TaskOrchestrationExecutor";
import { ReplaySchema } from "../../src/orchestrations/ReplaySchema";
import { EntityId } from "../../src/entities/EntityId";
import { DurableLock } from "../../src/entities/DurableLock";
import { LockState } from "../../src/entities/LockState";
import {
    LockingRulesViolationError,
    LockingRulesViolationMessages,
} from "../../src/error/LockingRulesViolationError";
import { LockEntitiesAction } from "../../src/actions/LockEntitiesAction";
import { ActionType } from "../../src/actions/ActionType";
import { HistoryEvent } from "../../src/history/HistoryEvent";
import { OrchestratorStartedEvent } from "../../src/history/OrchestratorStartedEvent";
import { HistoryEventOptions } from "../../src/history/HistoryEventOptions";
import { AtomicTask } from "../../src/task";

function newContext(
    schema: ReplaySchema = ReplaySchema.V4
): {
    ctx: DurableOrchestrationContext;
    executor: TaskOrchestrationExecutor;
} {
    const executor = new TaskOrchestrationExecutor();
    const history: HistoryEvent[] = [
        new OrchestratorStartedEvent(new HistoryEventOptions(0, new Date())),
    ];
    const ctx = new DurableOrchestrationContext(
        history,
        "test-instance",
        new Date(),
        false,
        undefined,
        "3.00:00:00",
        "6.00:00:00",
        30000,
        schema,
        undefined,
        executor
    );
    return { ctx, executor };
}

// -----------------------------------------------------------------------------
// Critical Sections unit coverage
//
// Grouped by concern:
//   - input validation:       arg shape (no-args, empty array, non-EntityId)
//   - schema-version gating:  lock() requires negotiated OOProc schema >= V4
//   - action emission:        lock() emits one LockEntitiesAction, sorted+deduped
//   - isLocked():             section-state reporting before/after lock
//   - rule enforcement:       nested lock, sub-orchestration, calls to unlocked
//                             entities, parallel-vs-sequential calls, signals
//   - re-lock after release:  section reset + re-acquire on the same entity
//   - DurableLock release:    idempotent release()/[Symbol.dispose]()/frozen locks
// -----------------------------------------------------------------------------
describe("Critical Sections (lock / isLocked)", () => {
    describe("input validation", () => {
        it("throws RangeError when called with no arguments", () => {
            const { ctx } = newContext();
            // Cast through `any` so the runtime guard is exercised; the public
            // overloads disallow zero-arg calls at the type level, but plain
            // JS callers can still hit this path.
            expect(() => (ctx as any).lock()).to.throw(RangeError, /at least one EntityId/);
        });

        it("throws RangeError when called with empty array", () => {
            const { ctx } = newContext();
            expect(() => ctx.lock([])).to.throw(RangeError, /at least one EntityId/);
        });

        it("throws TypeError when an element is not an EntityId", () => {
            const { ctx } = newContext();
            expect(() => ctx.lock([({ name: "x", key: "y" } as unknown) as EntityId])).to.throw(
                TypeError,
                /EntityId/
            );
        });
    });

    describe("schema-version gating", () => {
        it("throws a clear error when negotiated schema is below V4", () => {
            const { ctx } = newContext(ReplaySchema.V3);
            const a = new EntityId("Account", "A");
            expect(() => ctx.lock(a)).to.throw(/schema V4/);
        });
    });

    describe("action emission", () => {
        it("emits a single LockEntitiesAction with sorted+deduped lockset (varargs)", () => {
            const { ctx } = newContext();
            const a = new EntityId("Account", "A");
            const b = new EntityId("Account", "B");
            const task = ctx.lock(b, a) as AtomicTask;
            expect(task.actionObj).to.be.instanceOf(LockEntitiesAction);
            const action = task.actionObj as LockEntitiesAction;
            expect(action.actionType).to.equal(ActionType.LockEntities);
            expect(action.lockSet.map((e) => e.key)).to.deep.equal(["A", "B"]);
            expect(action.lockRequestId).to.be.a("string").and.not.empty;
        });

        it("array form produces identical lockset to varargs form", () => {
            const { ctx: ctx1 } = newContext();
            const { ctx: ctx2 } = newContext();
            const a = new EntityId("Account", "A");
            const b = new EntityId("Account", "B");
            const t1 = ctx1.lock(b, a) as AtomicTask;
            const t2 = ctx2.lock([b, a]) as AtomicTask;
            const a1 = t1.actionObj as LockEntitiesAction;
            const a2 = t2.actionObj as LockEntitiesAction;
            expect(a1.lockSet.map((e) => e.key)).to.deep.equal(a2.lockSet.map((e) => e.key));
        });

        it("dedupes duplicate entities in the lock set", () => {
            const { ctx } = newContext();
            const a = new EntityId("Account", "A");
            const task = ctx.lock(a, a, a) as AtomicTask;
            const action = task.actionObj as LockEntitiesAction;
            expect(action.lockSet).to.have.lengthOf(1);
        });
    });

    describe("isLocked()", () => {
        it("returns false before lock", () => {
            const { ctx } = newContext();
            const state = ctx.isLocked();
            expect(state).to.be.instanceOf(LockState);
            expect(state.isLocked).to.equal(false);
            expect(state.ownedLocks).to.deep.equal([]);
        });

        it("returns true and the owned locks after lock", () => {
            const { ctx } = newContext();
            const a = new EntityId("Account", "A");
            const b = new EntityId("Account", "B");
            ctx.lock(a, b);
            const state = ctx.isLocked();
            expect(state.isLocked).to.equal(true);
            expect(state.ownedLocks.map((e) => e.key)).to.deep.equal(["A", "B"]);
        });
    });

    describe("rule enforcement", () => {
        it("throws LockingRulesViolationError on nested lock", () => {
            const { ctx } = newContext();
            const a = new EntityId("Account", "A");
            const b = new EntityId("Account", "B");
            ctx.lock(a);
            expect(() => ctx.lock(b)).to.throw(
                LockingRulesViolationError,
                LockingRulesViolationMessages.NestedSection
            );
        });

        it("throws on sub-orchestration call inside section", () => {
            const { ctx } = newContext();
            ctx.lock(new EntityId("Account", "A"));
            expect(() => ctx.callSubOrchestrator("Child")).to.throw(
                LockingRulesViolationError,
                LockingRulesViolationMessages.SubOrchestrationInSection
            );
        });

        it("throws on callEntity to an entity outside the lock set", () => {
            const { ctx } = newContext();
            ctx.lock(new EntityId("Account", "A"));
            expect(() => ctx.callEntity(new EntityId("Account", "B"), "get")).to.throw(
                LockingRulesViolationError,
                LockingRulesViolationMessages.CallUnlockedEntity
            );
        });

        it("throws on parallel callEntity to the same locked entity", () => {
            const { ctx } = newContext();
            const a = new EntityId("Account", "A");
            ctx.lock(a);
            ctx.callEntity(a, "get");
            expect(() => ctx.callEntity(a, "get")).to.throw(
                LockingRulesViolationError,
                LockingRulesViolationMessages.ParallelSameEntity
            );
        });

        // Counterpart to the parallel case above: sequential calls to the same
        // locked entity ARE allowed. The guard only blocks a *second* call while
        // the first is still in flight. Once the first call resolves (the
        // executor invokes `_onEntityCallResolved`, clearing it from
        // `inFlightEntityCalls`), the next call is permitted.
        it("allows sequential callEntity to the same locked entity (after the prior call resolves)", () => {
            const { ctx } = newContext();
            const a = new EntityId("Account", "A");
            ctx.lock(a);
            ctx.callEntity(a, "get"); // first call: now in flight
            // Simulate the first call resolving, exactly as the executor does
            // (it passes CallEntityAction.instanceId, which is this scheduler id).
            ctx._onEntityCallResolved(EntityId.getSchedulerIdFromEntityId(a));
            expect(() => ctx.callEntity(a, "get")).to.not.throw();
        });

        it("throws on signalEntity to a locked entity", () => {
            const { ctx } = newContext();
            const a = new EntityId("Account", "A");
            ctx.lock(a);
            expect(() => ctx.signalEntity(a, "add", 1)).to.throw(
                LockingRulesViolationError,
                LockingRulesViolationMessages.SignalLockedEntity
            );
        });

        it("allows signalEntity to an entity outside the lock set", () => {
            const { ctx } = newContext();
            ctx.lock(new EntityId("Account", "A"));
            expect(() => ctx.signalEntity(new EntityId("Other", "X"), "noop")).to.not.throw();
        });
    });

    // Lock lifecycle: releasing a section resets `currentLock` to undefined so a
    // brand-new critical section can be opened afterwards. Confirms the invariant
    // lock -> work -> release -> lock again succeeds (no NestedSection violation).
    describe("re-lock after release", () => {
        it("a second lock() succeeds once the first section is released", () => {
            const { ctx } = newContext();
            const a = new EntityId("Account", "A");

            // Acquire the lock.
            const firstTask = ctx.lock(a) as AtomicTask & { __lockResult?: DurableLock };
            expect(ctx.isLocked().isLocked).to.equal(true);

            // Do work then release.
            const firstLock = firstTask.__lockResult as DurableLock;
            firstLock.release();

            // currentLock is now reset to undefined.
            expect(ctx.isLocked().isLocked).to.equal(false);

            // Re-lock the same entity: a new critical section opens cleanly.
            expect(() => ctx.lock(a)).to.not.throw();
            expect(ctx.isLocked().isLocked).to.equal(true);
            expect(ctx.isLocked().ownedLocks.map((e) => e.key)).to.deep.equal(["A"]);
        });
    });

    describe("DurableLock release", () => {
        it("release() is idempotent", () => {
            const lock = new DurableLock([new EntityId("X", "1")], () => {
                releaseCalls++;
            });
            let releaseCalls = 0;
            lock.release();
            lock.release();
            expect(releaseCalls).to.equal(1);
        });

        it("[Symbol.dispose]() aliases release()", () => {
            let calls = 0;
            const lock = new DurableLock([new EntityId("X", "1")], () => {
                calls++;
            });
            lock[Symbol.dispose]();
            expect(calls).to.equal(1);
            expect(lock.isReleased).to.equal(true);
        });

        it("ownedLocks is frozen", () => {
            const lock = new DurableLock([new EntityId("X", "1")], () => undefined);
            expect(Object.isFrozen(lock.ownedLocks)).to.equal(true);
        });
    });
});

// -----------------------------------------------------------------------------
// Replay-integration tests
//
// These exercise the full Orchestrator.handle pipeline (action emission +
// history matching), proving that the LockEntities action completes via the
// same EventSent->EventRaised re-keying machinery as CallEntity. The history
// shape produced by the extension for a lock acquisition is:
//   1) EventSent carrying a RequestMessage with `id` = lockRequestId GUID
//   2) EventRaised whose `Name` equals that GUID
// -----------------------------------------------------------------------------

import moment = require("moment");
import { v1 as uuidv1 } from "uuid";
import {
    DummyOrchestrationContext as DummyOrchestrationContextRuntime,
    createOrchestrator,
    DurableOrchestrationInput,
} from "../../src/util/testingUtils";
import { ExecutionStartedEvent } from "../../src/history/ExecutionStartedEvent";
import { EventSentEvent } from "../../src/history/EventSentEvent";
import { EventRaisedEvent } from "../../src/history/EventRaisedEvent";
import { OrchestratorCompletedEvent } from "../../src/history/OrchestratorCompletedEvent";

function buildLockHistory(
    firstTimestamp: Date,
    entities: EntityId[],
    lockRequestId: string,
    includeResponse: boolean
): HistoryEvent[] {
    const orchestratorId = uuidv1();
    const t0 = firstTimestamp;
    const t1 = moment(firstTimestamp).add(1, "s").toDate();
    const t2 = moment(firstTimestamp).add(2, "s").toDate();

    const events: HistoryEvent[] = [
        new OrchestratorStartedEvent({ eventId: -1, timestamp: t0, isPlayed: false }),
        new ExecutionStartedEvent({
            eventId: -1,
            timestamp: t1,
            isPlayed: true,
            name: orchestratorId,
            input: undefined,
        }),
        new EventSentEvent({
            eventId: 0,
            timestamp: t1,
            isPlayed: true,
            name: "op",
            input: JSON.stringify({
                id: lockRequestId,
                parent: orchestratorId,
                lockset: entities.map((e) => ({
                    name: e.name,
                    key: e.key,
                })),
                position: 0,
            }),
            instanceId: EntityId.getSchedulerIdFromEntityId(entities[0]),
        }),
        new OrchestratorCompletedEvent({ eventId: -1, timestamp: t1, isPlayed: true }),
    ];

    if (includeResponse) {
        events.push(
            new OrchestratorStartedEvent({ eventId: -1, timestamp: t2, isPlayed: false }),
            // The extension surfaces lock acquisition as an EventRaised
            // whose Name equals the lockRequestId GUID (the second arg to
            // WaitForExternalEvent, "LockAcquisitionCompleted", is only a log label).
            new EventRaisedEvent({
                eventId: -1,
                timestamp: t2,
                isPlayed: false,
                name: lockRequestId,
                input: JSON.stringify({ result: null }),
            })
        );
    }

    return events;
}

describe("Critical Sections - replay integration", () => {
    it("yields a DurableLock when the EventRaised response arrives", async () => {
        const src = new EntityId("Account", "A");
        const dst = new EntityId("Account", "B");
        let yieldedLock: DurableLock | undefined;

        const orchestrator = createOrchestrator(function* (context) {
            const lock = (yield context.df.lock(src, dst)) as DurableLock;
            yieldedLock = lock;
            return { locks: lock.ownedLocks.map((e) => e.key) };
        });

        // Predict the lockRequestId. The implementation derives it from
        // newGuid(instanceId) which uses (instanceId, currentUtcDateTime,
        // counter=0). To make the test deterministic, run once first to
        // capture what GUID the worker would generate, then rebuild history
        // with that GUID. We do this via a "first pass" where the response
        // is absent so the orchestration suspends and we can read the
        // emitted action's lockRequestId.
        const firstTs = moment.utc().toDate();
        const initialCtx = new DummyOrchestrationContextRuntime();
        const initialInput = new DurableOrchestrationInput(
            "test-instance-1",
            buildLockHistory(firstTs, [src, dst], "placeholder-not-used", false),
            undefined,
            undefined,
            undefined,
            undefined,
            ReplaySchema.V4
        );
        const firstResult = await orchestrator(initialInput, initialCtx);
        const emittedAction = firstResult.actions[0][0] as LockEntitiesAction;
        expect(emittedAction.actionType).to.equal(ActionType.LockEntities);
        const realLockRequestId = emittedAction.lockRequestId;

        // Now replay with a history that includes the response keyed by the
        // real lockRequestId.
        const fullHistory = buildLockHistory(firstTs, [src, dst], realLockRequestId, true);
        const replayCtx = new DummyOrchestrationContextRuntime();
        const replayInput = new DurableOrchestrationInput(
            "test-instance-1",
            fullHistory,
            undefined,
            undefined,
            undefined,
            undefined,
            ReplaySchema.V4
        );
        const replayResult = await orchestrator(replayInput, replayCtx);

        expect(replayResult.isDone).to.equal(true);
        expect(replayResult.output).to.deep.equal({ locks: ["A", "B"] });
        expect(yieldedLock).to.be.instanceOf(DurableLock);
        expect((yieldedLock as DurableLock).ownedLocks.map((e) => e.key)).to.deep.equal(["A", "B"]);
    });

    it("suspends (isDone=false) when the EventRaised response is missing", async () => {
        const a = new EntityId("Account", "A");

        const orchestrator = createOrchestrator(function* (context) {
            yield context.df.lock(a);
            return "should-not-reach";
        });

        const firstTs = moment.utc().toDate();
        const ctx = new DummyOrchestrationContextRuntime();
        const input = new DurableOrchestrationInput(
            "test-instance-2",
            buildLockHistory(firstTs, [a], "irrelevant", false),
            undefined,
            undefined,
            undefined,
            undefined,
            ReplaySchema.V4
        );
        const result = await orchestrator(input, ctx);

        expect(result.isDone).to.equal(false);
        expect(result.actions[0]).to.have.lengthOf(1);
        expect((result.actions[0][0] as LockEntitiesAction).actionType).to.equal(
            ActionType.LockEntities
        );
    });

    it("emits ReleaseEntities action when lock.release() is called", async () => {
        const a = new EntityId("Account", "A");

        const orchestrator = createOrchestrator(function* (context) {
            const lock = (yield context.df.lock(a)) as DurableLock;
            lock.release();
            return "done";
        });

        // First pass to read the generated lockRequestId.
        const firstTs = moment.utc().toDate();
        const probeCtx = new DummyOrchestrationContextRuntime();
        const probeInput = new DurableOrchestrationInput(
            "test-instance-3",
            buildLockHistory(firstTs, [a], "x", false),
            undefined,
            undefined,
            undefined,
            undefined,
            ReplaySchema.V4
        );
        const probeResult = await orchestrator(probeInput, probeCtx);
        const lockRequestId = (probeResult.actions[0][0] as LockEntitiesAction).lockRequestId;

        // Replay with response present so release() actually executes.
        const replayCtx = new DummyOrchestrationContextRuntime();
        const replayInput = new DurableOrchestrationInput(
            "test-instance-3",
            buildLockHistory(firstTs, [a], lockRequestId, true),
            undefined,
            undefined,
            undefined,
            undefined,
            ReplaySchema.V4
        );
        const result = await orchestrator(replayInput, replayCtx);

        expect(result.isDone).to.equal(true);
        expect(result.actions[0]).to.have.lengthOf(2);
        expect(result.actions[0][0].actionType).to.equal(ActionType.LockEntities);
        expect(result.actions[0][1].actionType).to.equal(ActionType.ReleaseEntities);
    });
});

// -----------------------------------------------------------------------------
// Release-pattern parity matrix
//
// The public release surface offers three patterns: explicit `release()`,
// `try/finally`, and `[Symbol.dispose]()` (the underlying mechanic of TS 5.2+
// `using` syntax). We can't exercise the `using` *syntax* from a TS 4.x test
// project, but we can directly invoke `[Symbol.dispose]()` which is the same
// runtime call the compiler emits. The invariant verified by this matrix:
// regardless of release pattern, the emitted action stream is identical
// ([LockEntities, ReleaseEntities] in that order).
// -----------------------------------------------------------------------------

describe("Critical Sections - release-pattern parity", () => {
    const entity = new EntityId("Account", "A");

    async function runWithRelease(
        release: (lock: DurableLock) => void
    ): Promise<{ types: ActionType[] }> {
        const orchestrator = createOrchestrator(function* (context) {
            const lock = (yield context.df.lock(entity)) as DurableLock;
            release(lock);
            return "ok";
        });

        // Probe pass to capture the deterministic lockRequestId.
        const firstTs = moment.utc().toDate();
        const probeCtx = new DummyOrchestrationContextRuntime();
        const probeInput = new DurableOrchestrationInput(
            "matrix-instance",
            buildLockHistory(firstTs, [entity], "x", false),
            undefined,
            undefined,
            undefined,
            undefined,
            ReplaySchema.V4
        );
        const probe = await orchestrator(probeInput, probeCtx);
        const lockRequestId = (probe.actions[0][0] as LockEntitiesAction).lockRequestId;

        const replayCtx = new DummyOrchestrationContextRuntime();
        const replayInput = new DurableOrchestrationInput(
            "matrix-instance",
            buildLockHistory(firstTs, [entity], lockRequestId, true),
            undefined,
            undefined,
            undefined,
            undefined,
            ReplaySchema.V4
        );
        const result = await orchestrator(replayInput, replayCtx);
        expect(result.isDone).to.equal(true);
        return { types: result.actions[0].map((a: { actionType: ActionType }) => a.actionType) };
    }

    it("explicit release() emits [LockEntities, ReleaseEntities]", async () => {
        const { types } = await runWithRelease((l) => l.release());
        expect(types).to.deep.equal([ActionType.LockEntities, ActionType.ReleaseEntities]);
    });

    it("[Symbol.dispose]() emits the same action stream as release()", async () => {
        const { types } = await runWithRelease((l) => l[Symbol.dispose]());
        expect(types).to.deep.equal([ActionType.LockEntities, ActionType.ReleaseEntities]);
    });

    it("double-release is idempotent (still emits exactly one ReleaseEntities)", async () => {
        const { types } = await runWithRelease((l) => {
            l.release();
            l.release();
            l[Symbol.dispose]();
        });
        expect(types).to.deep.equal([ActionType.LockEntities, ActionType.ReleaseEntities]);
    });

    it("try/finally releases when the protected code throws", async () => {
        const orchestrator = createOrchestrator(function* (context) {
            const lock = (yield context.df.lock(entity)) as DurableLock;
            try {
                throw new Error("boom inside section");
            } finally {
                lock.release();
            }
        });

        // Probe.
        const firstTs = moment.utc().toDate();
        const probeCtx = new DummyOrchestrationContextRuntime();
        const probeInput = new DurableOrchestrationInput(
            "throw-instance",
            buildLockHistory(firstTs, [entity], "x", false),
            undefined,
            undefined,
            undefined,
            undefined,
            ReplaySchema.V4
        );
        const probe = await orchestrator(probeInput, probeCtx);
        const lockRequestId = (probe.actions[0][0] as LockEntitiesAction).lockRequestId;

        // Replay — orchestration is expected to fail with the user error,
        // but the release action MUST still have been emitted before the
        // throw bubbled up.
        const replayCtx = new DummyOrchestrationContextRuntime();
        const replayInput = new DurableOrchestrationInput(
            "throw-instance",
            buildLockHistory(firstTs, [entity], lockRequestId, true),
            undefined,
            undefined,
            undefined,
            undefined,
            ReplaySchema.V4
        );

        let caught: unknown;
        try {
            await orchestrator(replayInput, replayCtx);
        } catch (e) {
            caught = e;
        }
        expect(caught, "orchestration should have surfaced the user error").to.exist;
        const errMsg = (caught as Error).message;
        const label = "\n\n$OutOfProcData$:";
        const dataStart = errMsg.indexOf(label) + label.length;
        const state = JSON.parse(errMsg.substr(dataStart)) as {
            actions: { actionType: ActionType }[][];
        };
        const types = state.actions[0].map((a) => a.actionType);
        expect(types).to.deep.equal([ActionType.LockEntities, ActionType.ReleaseEntities]);
    });

    it("no release leaves the action stream as [LockEntities] only (implicit release at orchestration end)", async () => {
        const orchestrator = createOrchestrator(function* (context) {
            yield context.df.lock(entity);
            return "implicit";
        });

        const firstTs = moment.utc().toDate();
        const probeCtx = new DummyOrchestrationContextRuntime();
        const probeInput = new DurableOrchestrationInput(
            "implicit-instance",
            buildLockHistory(firstTs, [entity], "x", false),
            undefined,
            undefined,
            undefined,
            undefined,
            ReplaySchema.V4
        );
        const probe = await orchestrator(probeInput, probeCtx);
        const lockRequestId = (probe.actions[0][0] as LockEntitiesAction).lockRequestId;

        const replayCtx = new DummyOrchestrationContextRuntime();
        const replayInput = new DurableOrchestrationInput(
            "implicit-instance",
            buildLockHistory(firstTs, [entity], lockRequestId, true),
            undefined,
            undefined,
            undefined,
            undefined,
            ReplaySchema.V4
        );
        const result = await orchestrator(replayInput, replayCtx);

        expect(result.isDone).to.equal(true);
        // No ReleaseEntities action -- the extension cleans up at
        // orchestration termination. This is the documented safety net.
        const types = result.actions[0].map((a: { actionType: ActionType }) => a.actionType);
        expect(types).to.deep.equal([ActionType.LockEntities]);
    });
});
