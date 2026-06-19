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
import { AtomicTask, LockTask } from "../../src/task";

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
            const firstTask = ctx.lock(a) as LockTask;
            expect(ctx.isLocked().isLocked).to.equal(true);

            // Do work then release.
            const firstLock = firstTask.lockResult;
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
import { TaskCompletedEvent } from "../../src/history/TaskCompletedEvent";
import { TimerFiredEvent } from "../../src/history/TimerFiredEvent";

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

// -----------------------------------------------------------------------------
// Builds the history for `lock(entities) -> release() -> callActivity`.
//
// The extension's ReleaseLocks() sends one entity message per locked entity, so
// releasing an N-entity lock consumes N task-ID slots in the backend's sequence
// space. The extension-side task IDs are:
//   id 0        : lock request (single EventSent to the first entity)
//   ids 1..N    : one release message per locked entity
//   id N + 1    : the activity scheduled immediately after release
// So the activity's TaskCompleted carries TaskScheduledId = N + 1, and the
// worker advances its sequence counter by N at the release to match it.
// -----------------------------------------------------------------------------
function buildLockReleaseActivityHistory(
    firstTimestamp: Date,
    entities: EntityId[],
    lockRequestId: string,
    includeResponse: boolean,
    activityResult: unknown
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
                lockset: entities.map((e) => ({ name: e.name, key: e.key })),
                position: 0,
            }),
            instanceId: EntityId.getSchedulerIdFromEntityId(entities[0]),
        }),
        new OrchestratorCompletedEvent({ eventId: -1, timestamp: t1, isPlayed: true }),
    ];

    if (includeResponse) {
        // lock = id 0, release messages = ids 1..N, activity = id N + 1.
        const activityTaskId = entities.length + 1;
        events.push(
            new OrchestratorStartedEvent({ eventId: -1, timestamp: t2, isPlayed: false }),
            // Lock acquired (EventRaised keyed by the lockRequestId GUID).
            new EventRaisedEvent({
                eventId: -1,
                timestamp: t2,
                isPlayed: false,
                name: lockRequestId,
                input: JSON.stringify({ result: null }),
            }),
            // The activity scheduled right after the release completes.
            new TaskCompletedEvent({
                eventId: -1,
                timestamp: t2,
                isPlayed: false,
                taskScheduledId: activityTaskId,
                result: JSON.stringify(activityResult),
            })
        );
    }

    return events;
}

describe("Critical Sections - early release then durable work", () => {
    // lock(entities) -> release() -> callActivity, driven through the full
    // replay pipeline. Returns the final orchestrator state.
    async function runLockReleaseThenActivity(
        entities: EntityId[],
        activityResult: unknown
    ): Promise<{ isDone: boolean; output: unknown; actionTypes: ActionType[] }> {
        const orchestrator = createOrchestrator(function* (context) {
            const lock = (yield context.df.lock(entities)) as DurableLock;
            // Release the section, then schedule further durable work.
            lock.release();
            const receipt = yield context.df.callActivity("sendReceipt", { ok: true });
            return { receipt, lockedAfter: context.df.isLocked().isLocked };
        });

        const firstTs = moment.utc().toDate();

        // Probe pass (lock response absent) to capture the deterministic
        // lockRequestId the worker generates.
        const probeCtx = new DummyOrchestrationContextRuntime();
        const probeInput = new DurableOrchestrationInput(
            "early-release-instance",
            buildLockReleaseActivityHistory(firstTs, entities, "placeholder", false, undefined),
            undefined,
            undefined,
            undefined,
            undefined,
            ReplaySchema.V4
        );
        const probe = await orchestrator(probeInput, probeCtx);
        const lockRequestId = (probe.actions[0][0] as LockEntitiesAction).lockRequestId;

        // Real pass with the lock response and the post-release activity
        // completion (TaskScheduledId = N + 1) present.
        const replayCtx = new DummyOrchestrationContextRuntime();
        const replayInput = new DurableOrchestrationInput(
            "early-release-instance",
            buildLockReleaseActivityHistory(firstTs, entities, lockRequestId, true, activityResult),
            undefined,
            undefined,
            undefined,
            undefined,
            ReplaySchema.V4
        );
        const result = await orchestrator(replayInput, replayCtx);
        return {
            isDone: result.isDone,
            output: result.output,
            actionTypes: result.actions[0].map((a: { actionType: ActionType }) => a.actionType),
        };
    }

    it("completes after a 2-entity lock is released and an activity is scheduled", async () => {
        const a = new EntityId("Account", "A");
        const b = new EntityId("Account", "B");
        const result = await runLockReleaseThenActivity([a, b], "receipt-AB");

        // The activity completes as TaskScheduledId = N + 1 = 3; the worker must
        // advance its counter by N = 2 at the release for the IDs to line up.
        expect(result.isDone).to.equal(true);
        expect(result.output).to.deep.equal({ receipt: "receipt-AB", lockedAfter: false });
        expect(result.actionTypes).to.deep.equal([
            ActionType.LockEntities,
            ActionType.ReleaseEntities,
            ActionType.CallActivity,
        ]);
    });

    it("completes after a 3-entity lock is released and an activity is scheduled", async () => {
        // Proves the counter advances by the lock-set size (N), not a fixed
        // amount: here the activity's completion is TaskScheduledId = 4.
        const a = new EntityId("Account", "A");
        const b = new EntityId("Account", "B");
        const c = new EntityId("Account", "C");
        const result = await runLockReleaseThenActivity([a, b, c], "receipt-ABC");

        expect(result.isDone).to.equal(true);
        expect(result.output).to.deep.equal({ receipt: "receipt-ABC", lockedAfter: false });
        expect(result.actionTypes).to.deep.equal([
            ActionType.LockEntities,
            ActionType.ReleaseEntities,
            ActionType.CallActivity,
        ]);
    });
});

// -----------------------------------------------------------------------------
// Many awaits after an early release
//
// After releasing a 2-entity lock, schedule several sequential durable
// operations and prove every one of them resolves. The release advances the
// worker's task-ID counter by the lock-set size so the IDs of all following
// awaits stay aligned with the extension; these tests pin the whole
// post-release tail, not just the first op.
//
// ID layout for a 2-entity lock (N = 2):
//   id 0        : lock request
//   ids 1, 2    : the two release messages
//   ids 3, 4... : each sequential durable op scheduled after the release
// A non-durable statement (plain JS between yields) schedules no backend
// message and therefore consumes no task-ID slot.
// -----------------------------------------------------------------------------
function buildLockReleaseThenActivitiesHistory(
    firstTimestamp: Date,
    entities: EntityId[],
    lockRequestId: string,
    includeResponse: boolean,
    activityResults: unknown[]
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
                lockset: entities.map((e) => ({ name: e.name, key: e.key })),
                position: 0,
            }),
            instanceId: EntityId.getSchedulerIdFromEntityId(entities[0]),
        }),
        new OrchestratorCompletedEvent({ eventId: -1, timestamp: t1, isPlayed: true }),
    ];

    if (includeResponse) {
        // lock = id 0, release messages = ids 1..N, activities = ids N+1, N+2, ...
        const firstActivityId = entities.length + 1;
        events.push(
            new OrchestratorStartedEvent({ eventId: -1, timestamp: t2, isPlayed: false }),
            new EventRaisedEvent({
                eventId: -1,
                timestamp: t2,
                isPlayed: false,
                name: lockRequestId,
                input: JSON.stringify({ result: null }),
            })
        );
        activityResults.forEach((res, i) => {
            events.push(
                new TaskCompletedEvent({
                    eventId: -1,
                    timestamp: t2,
                    isPlayed: false,
                    taskScheduledId: firstActivityId + i,
                    result: JSON.stringify(res),
                })
            );
        });
    }

    return events;
}

describe("Critical Sections - many awaits after early release", () => {
    // Two-pass driver: a probe pass (lock response absent) captures the
    // deterministic lockRequestId, then a real pass replays with the lock
    // response and every post-release activity completion present.
    async function driveLockReleaseThenActivities(
        orchestrator: ReturnType<typeof createOrchestrator>,
        entities: EntityId[],
        activityResults: unknown[],
        label: string
    ): Promise<{ isDone: boolean; output: unknown; actionTypes: ActionType[] }> {
        const firstTs = moment.utc().toDate();

        const probeInput = new DurableOrchestrationInput(
            label,
            buildLockReleaseThenActivitiesHistory(firstTs, entities, "placeholder", false, []),
            undefined,
            undefined,
            undefined,
            undefined,
            ReplaySchema.V4
        );
        const probe = await orchestrator(probeInput, new DummyOrchestrationContextRuntime());
        const lockRequestId = (probe.actions[0][0] as LockEntitiesAction).lockRequestId;

        const replayInput = new DurableOrchestrationInput(
            label,
            buildLockReleaseThenActivitiesHistory(
                firstTs,
                entities,
                lockRequestId,
                true,
                activityResults
            ),
            undefined,
            undefined,
            undefined,
            undefined,
            ReplaySchema.V4
        );
        const result = await orchestrator(replayInput, new DummyOrchestrationContextRuntime());
        return {
            isDone: result.isDone,
            output: result.output,
            actionTypes: result.actions[0].map((a: { actionType: ActionType }) => a.actionType),
        };
    }

    it("completes when 4 awaits follow an early release", async () => {
        const a = new EntityId("Account", "A");
        const b = new EntityId("Account", "B");
        // Four post-release activities -> TaskScheduledId 3, 4, 5, 6.
        const results = ["r1", "r2", "r3", "r4"];

        const orchestrator = createOrchestrator(function* (context) {
            const lock = (yield context.df.lock(a, b)) as DurableLock;
            lock.release();
            const o1 = yield context.df.callActivity("act", 1);
            const o2 = yield context.df.callActivity("act", 2);
            const o3 = yield context.df.callActivity("act", 3);
            const o4 = yield context.df.callActivity("act", 4);
            return [o1, o2, o3, o4];
        });

        const result = await driveLockReleaseThenActivities(
            orchestrator,
            [a, b],
            results,
            "release-4-awaits"
        );

        // Every post-release await must resolve in order; isDone confirms the
        // whole tail stayed aligned with the extension's task IDs.
        expect(result.isDone).to.equal(true);
        expect(result.output).to.deep.equal(["r1", "r2", "r3", "r4"]);
        expect(result.actionTypes).to.deep.equal([
            ActionType.LockEntities,
            ActionType.ReleaseEntities,
            ActionType.CallActivity,
            ActionType.CallActivity,
            ActionType.CallActivity,
            ActionType.CallActivity,
        ]);
    });

    it("completes with 2 awaits, a non-durable statement, then 3 more awaits after release", async () => {
        const a = new EntityId("Account", "A");
        const b = new EntityId("Account", "B");
        // Five post-release activities -> TaskScheduledId 3, 4, 5, 6, 7. The
        // plain `localSum` statement between them schedules nothing, so it must
        // NOT consume a task-ID slot.
        const results = [10, 20, 100, 200, 300];

        const orchestrator = createOrchestrator(function* (context) {
            const lock = (yield context.df.lock(a, b)) as DurableLock;
            lock.release();
            const r1 = yield context.df.callActivity("act", 1);
            const r2 = yield context.df.callActivity("act", 2);
            // Non-durable line: pure JS, no yield, no backend message.
            const localSum = (r1 as number) + (r2 as number);
            const r3 = yield context.df.callActivity("act", 3);
            const r4 = yield context.df.callActivity("act", 4);
            const r5 = yield context.df.callActivity("act", 5);
            return { r1, r2, r3, r4, r5, localSum };
        });

        const result = await driveLockReleaseThenActivities(
            orchestrator,
            [a, b],
            results,
            "release-2-nondurable-3"
        );

        expect(result.isDone).to.equal(true);
        expect(result.output).to.deep.equal({
            r1: 10,
            r2: 20,
            r3: 100,
            r4: 200,
            r5: 300,
            localSum: 30,
        });
        expect(result.actionTypes).to.deep.equal([
            ActionType.LockEntities,
            ActionType.ReleaseEntities,
            ActionType.CallActivity,
            ActionType.CallActivity,
            ActionType.CallActivity,
            ActionType.CallActivity,
            ActionType.CallActivity,
        ]);
    });
});

// -----------------------------------------------------------------------------
// Post-release op-type coverage (timer + entity)
//
// Each durable op type resolves through a different completion-matching path in
// the executor:
//   - activity -> TaskCompleted keyed by TaskScheduledId   (covered above)
//   - timer    -> TimerFired    keyed by TimerId
//   - entity   -> EventSent re-key (by request GUID) then EventRaised by Name
// These confirm the post-release op's task ID lands correctly in the timer and
// entity paths too. For a 2-entity lock the post-release op is id 3 (lock = 0,
// the two release messages = 1 and 2).
// -----------------------------------------------------------------------------

// Shared prefix: OrchestratorStarted + ExecutionStarted + the lock's EventSent
// (id 0) + OrchestratorCompleted. The lock acquisition is surfaced later as an
// EventRaised keyed by the lockRequestId GUID, exactly like buildLockHistory.
function lockPrefixEvents(
    orchestratorId: string,
    t0: Date,
    t1: Date,
    entities: EntityId[],
    lockRequestId: string
): HistoryEvent[] {
    return [
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
                lockset: entities.map((e) => ({ name: e.name, key: e.key })),
                position: 0,
            }),
            instanceId: EntityId.getSchedulerIdFromEntityId(entities[0]),
        }),
        new OrchestratorCompletedEvent({ eventId: -1, timestamp: t1, isPlayed: true }),
    ];
}

// lock(entities) -> release() -> createTimer. The timer's completion is a
// TimerFired keyed by TimerId = N + 1 (entities.length + 1).
function buildLockReleaseTimerHistory(
    firstTimestamp: Date,
    entities: EntityId[],
    lockRequestId: string,
    includeResponse: boolean
): HistoryEvent[] {
    const orchestratorId = uuidv1();
    const t0 = firstTimestamp;
    const t1 = moment(firstTimestamp).add(1, "s").toDate();
    const t2 = moment(firstTimestamp).add(2, "s").toDate();

    const events = lockPrefixEvents(orchestratorId, t0, t1, entities, lockRequestId);

    if (includeResponse) {
        const timerId = entities.length + 1;
        events.push(
            new OrchestratorStartedEvent({ eventId: -1, timestamp: t2, isPlayed: false }),
            new EventRaisedEvent({
                eventId: -1,
                timestamp: t2,
                isPlayed: false,
                name: lockRequestId,
                input: JSON.stringify({ result: null }),
            }),
            new TimerFiredEvent({
                eventId: -1,
                timestamp: t2,
                isPlayed: false,
                timerId,
                fireAt: t2,
            })
        );
    }

    return events;
}

// lock(entities) -> release() -> callEntity(target, "get"). The entity call is
// scheduled as id N + 1; its EventSent (EventId = N + 1) re-keys the open task
// to the request GUID, then an EventRaised by that GUID delivers the response.
function buildLockReleaseEntityHistory(
    firstTimestamp: Date,
    entities: EntityId[],
    target: EntityId,
    lockRequestId: string,
    entityRequestId: string,
    includeResponse: boolean,
    entityResult: unknown
): HistoryEvent[] {
    const orchestratorId = uuidv1();
    const t0 = firstTimestamp;
    const t1 = moment(firstTimestamp).add(1, "s").toDate();
    const t2 = moment(firstTimestamp).add(2, "s").toDate();

    const events = lockPrefixEvents(orchestratorId, t0, t1, entities, lockRequestId);

    if (includeResponse) {
        const entityCallTaskId = entities.length + 1;
        events.push(
            new OrchestratorStartedEvent({ eventId: -1, timestamp: t2, isPlayed: false }),
            // Lock acquired.
            new EventRaisedEvent({
                eventId: -1,
                timestamp: t2,
                isPlayed: false,
                name: lockRequestId,
                input: JSON.stringify({ result: null }),
            }),
            // The post-release callEntity's EventSent. EventId must equal the
            // task's predicted id (N + 1) so the executor re-keys it to the
            // request GUID; this is the entity-specific completion path.
            new EventSentEvent({
                eventId: entityCallTaskId,
                timestamp: t2,
                isPlayed: false,
                name: "op",
                input: JSON.stringify({
                    id: entityRequestId,
                    parent: orchestratorId,
                    name: "get",
                }),
                instanceId: EntityId.getSchedulerIdFromEntityId(target),
            }),
            // The entity response, keyed by the request GUID.
            new EventRaisedEvent({
                eventId: -1,
                timestamp: t2,
                isPlayed: false,
                name: entityRequestId,
                input: JSON.stringify({ result: JSON.stringify(entityResult) }),
            })
        );
    }

    return events;
}

describe("Critical Sections - post-release op-type coverage", () => {
    it("completes when a timer is scheduled after an early release", async () => {
        const a = new EntityId("Account", "A");
        const b = new EntityId("Account", "B");

        const orchestrator = createOrchestrator(function* (context) {
            const lock = (yield context.df.lock(a, b)) as DurableLock;
            lock.release();
            // Durable timer AFTER release (TimerFired keyed by TimerId = 3).
            const fireAt = new Date(context.df.currentUtcDateTime.getTime() + 1000);
            yield context.df.createTimer(fireAt);
            return { firedAfterRelease: true, lockedAfter: context.df.isLocked().isLocked };
        });

        const firstTs = moment.utc().toDate();
        const probeInput = new DurableOrchestrationInput(
            "release-then-timer",
            buildLockReleaseTimerHistory(firstTs, [a, b], "placeholder", false),
            undefined,
            undefined,
            undefined,
            undefined,
            ReplaySchema.V4
        );
        const probe = await orchestrator(probeInput, new DummyOrchestrationContextRuntime());
        const lockRequestId = (probe.actions[0][0] as LockEntitiesAction).lockRequestId;

        const replayInput = new DurableOrchestrationInput(
            "release-then-timer",
            buildLockReleaseTimerHistory(firstTs, [a, b], lockRequestId, true),
            undefined,
            undefined,
            undefined,
            undefined,
            ReplaySchema.V4
        );
        const result = await orchestrator(replayInput, new DummyOrchestrationContextRuntime());

        expect(result.isDone).to.equal(true);
        expect(result.output).to.deep.equal({ firedAfterRelease: true, lockedAfter: false });
        expect(
            result.actions[0].map((x: { actionType: ActionType }) => x.actionType)
        ).to.deep.equal([
            ActionType.LockEntities,
            ActionType.ReleaseEntities,
            ActionType.CreateTimer,
        ]);
    });

    it("completes when a callEntity is scheduled after an early release", async () => {
        const a = new EntityId("Account", "A");
        const b = new EntityId("Account", "B");
        const target = new EntityId("Account", "C"); // unlocked once the section is released
        const entityRequestId = "entity-req-guid"; // authored on both EventSent input and EventRaised name

        const orchestrator = createOrchestrator(function* (context) {
            const lock = (yield context.df.lock(a, b)) as DurableLock;
            lock.release();
            // Durable callEntity AFTER release (scheduled as id 3, resolved via
            // the EventSent re-key -> EventRaised path).
            const value = yield context.df.callEntity(target, "get");
            return { value, lockedAfter: context.df.isLocked().isLocked };
        });

        const firstTs = moment.utc().toDate();
        const probeInput = new DurableOrchestrationInput(
            "release-then-entity",
            buildLockReleaseEntityHistory(
                firstTs,
                [a, b],
                target,
                "placeholder",
                entityRequestId,
                false,
                undefined
            ),
            undefined,
            undefined,
            undefined,
            undefined,
            ReplaySchema.V4
        );
        const probe = await orchestrator(probeInput, new DummyOrchestrationContextRuntime());
        const lockRequestId = (probe.actions[0][0] as LockEntitiesAction).lockRequestId;

        const replayInput = new DurableOrchestrationInput(
            "release-then-entity",
            buildLockReleaseEntityHistory(
                firstTs,
                [a, b],
                target,
                lockRequestId,
                entityRequestId,
                true,
                42
            ),
            undefined,
            undefined,
            undefined,
            undefined,
            ReplaySchema.V4
        );
        const result = await orchestrator(replayInput, new DummyOrchestrationContextRuntime());

        expect(result.isDone).to.equal(true);
        expect(result.output).to.deep.equal({ value: 42, lockedAfter: false });
        expect(
            result.actions[0].map((x: { actionType: ActionType }) => x.actionType)
        ).to.deep.equal([
            ActionType.LockEntities,
            ActionType.ReleaseEntities,
            ActionType.CallEntity,
        ]);
    });
});
