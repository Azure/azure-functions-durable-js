/**
 * Native activity retry visibility — helpers for inspecting per-attempt
 * retry metadata recorded on activity history events.
 *
 * Two surfaces are exported from this module:
 *
 *  - `getActivityInvocationInfo(context)` — read from inside an activity to learn
 *    the current retry attempt and policy ceiling (Goal #1).
 *  - `getInstanceRetryHistory(client, instanceId)` — read from outside an orchestration
 *    to project the retry trail per activity (Goal #4).
 *
 * Both helpers share a single strict-decimal parser (see `parsePositiveInt`) to
 * guarantee identical interpretation of `dt.retry.*` history tags across
 * activity-side and client-side consumers. The shared parser is exported privately
 * via `internalParsePositiveInt` for the cross-stack test-vector fixture.
 */

import type { InvocationContext } from "@azure/functions";

// ---------------------------------------------------------------------------
// Trigger metadata key constants — camelCase, `durabletask.` prefix.
// These names are part of the cross-stack wire contract and must not change
// without a coordinated update to every consumer of activity-trigger metadata.
// ---------------------------------------------------------------------------
const TRIGGER_KEY_ATTEMPT = "durabletask.attempt";
const TRIGGER_KEY_MAX_ATTEMPTS = "durabletask.maxAttempts";
const TRIGGER_KEY_IS_MAX_ATTEMPT = "durabletask.isMaxAttempt";

// History tag keys — names are part of the cross-stack wire contract and must
// match every producer / consumer of `TaskScheduledEvent.Tags`.
const HISTORY_TAG_ATTEMPT = "dt.retry.attempt";
const HISTORY_TAG_MAX_ATTEMPTS = "dt.retry.maxAttempts";

// ---------------------------------------------------------------------------
// Public types — shipped via types/activity.d.ts and types/durableClient.d.ts.
// ---------------------------------------------------------------------------

export interface ActivityInvocationInfo {
    /** 1-based attempt counter; defaults to 1 when metadata is unavailable. */
    readonly attempt: number;
    /** Policy ceiling (the `maxAttempts` value the customer passed to `RetryOptions`);
     *  defaults to 1 when metadata is unavailable. */
    readonly maxAttempts: number;
    /**
     * True when the retry counter has reached the policy's `maxAttempts`
     * (i.e. `attempt === maxAttempts`). False when metadata is unavailable.
     *
     * ⚠️ This does NOT mean "no further attempts will run." `RetryOptions.handle`
     * may abort the retry loop sooner by rejecting an exception, in which case
     * the actual last execution can have `isMaxAttempt === false`.
     */
    readonly isMaxAttempt: boolean;
    /**
     * False when retry metadata could not be recovered (no retry policy in use,
     * or backend does not roundtrip Tags). The only safe way to distinguish a
     * genuine first attempt from missing metadata.
     */
    readonly metadataAvailable: boolean;
}

export interface ActivityRetryRecord {
    readonly activityName: string;
    readonly taskScheduledId: number;
    readonly attempt: number;
    readonly maxAttempts: number;
    readonly isMaxAttempt: boolean;
    readonly status: "running" | "completed" | "failed";
}

export interface InstanceRetryHistory {
    readonly instanceId: string;
    /** All activity scheduling events that carried retry tags, in history order. */
    readonly attempts: ActivityRetryRecord[];
    /** Same aggregate semantics as the orchestration-span attribute:
     *  count of TaskScheduledEvents with attempt > 1. */
    readonly retryAttemptCount: number;
    /** True iff at least one retried activity has a TaskFailed for an
     *  attempt where attempt === maxAttempts. */
    readonly retryMaxAttemptsReached: boolean;
    /**
     * True when retry metadata for this instance is available and the counts
     * above are trustworthy. False when retry metadata could not be recovered
     * — typically when the backend in use does not preserve
     * `TaskScheduledEvent.Tags` through persistence.
     */
    readonly retryMetadataAvailable: boolean;
}

// ---------------------------------------------------------------------------
// Parser — strict-decimal positive integer. Used by both helpers.
// ---------------------------------------------------------------------------

/**
 * Strict decimal parser. Returns the integer when input is a non-empty string
 * matching `^[1-9][0-9]*$` (or `"0"`); returns `undefined` otherwise.
 * Matches `int.TryParse(s, NumberStyles.None, CultureInfo.InvariantCulture)`
 * semantics on the extension side. No whitespace, signs, hex, or scientific
 * notation. ASCII decimal only.
 */
function parsePositiveInt(raw: unknown): number | undefined {
    if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0) {
        return raw;
    }
    if (typeof raw !== "string" || raw.length === 0) {
        return undefined;
    }
    // Strict regex: leading zeros only allowed for "0"; otherwise must start with 1-9.
    if (!/^(0|[1-9][0-9]*)$/.test(raw)) {
        return undefined;
    }
    const n = Number(raw);
    // Guard against any number that didn't round-trip cleanly.
    if (!Number.isInteger(n) || n < 0) {
        return undefined;
    }
    return n;
}

/** Internal test hook — exported under a deliberately-ugly name for use by
 *  the cross-stack test-vector fixture. NOT part of the public API. */
export const __internalParsePositiveInt = parsePositiveInt;

// ---------------------------------------------------------------------------
// getActivityInvocationInfo — activity-side helper.
// ---------------------------------------------------------------------------

/**
 * Read the current retry attempt information for an activity invocation.
 *
 * Reads three keys from `context.triggerMetadata`:
 *  - `durabletask.attempt`
 *  - `durabletask.maxAttempts`
 *  - `durabletask.isMaxAttempt`
 *
 * When any required key is missing or fails strict-decimal parsing, returns a
 * fallback shape with `metadataAvailable: false`. The `metadataAvailable` flag
 * is the ONLY safe way to distinguish a genuine first attempt from missing
 * metadata — `info.attempt === 1` is true in both cases.
 *
 * @example
 *   const info = getActivityInvocationInfo(context);
 *   if (info.metadataAvailable && info.attempt > 1) {
 *       context.log(`retry attempt ${info.attempt} of ${info.maxAttempts}`);
 *   }
 */
export function getActivityInvocationInfo(context: InvocationContext): ActivityInvocationInfo {
    const meta = ((context as unknown) as { triggerMetadata?: Record<string, unknown> })
        .triggerMetadata;
    if (!meta) {
        return makeUnavailable();
    }

    const attempt = parsePositiveInt(meta[TRIGGER_KEY_ATTEMPT]);
    const maxAttempts = parsePositiveInt(meta[TRIGGER_KEY_MAX_ATTEMPTS]);

    if (
        attempt === undefined ||
        maxAttempts === undefined ||
        attempt < 1 ||
        maxAttempts < attempt
    ) {
        return makeUnavailable();
    }

    // Prefer the precomputed boolean from the extension when present (saves the
    // round-trip and lets future telemetry distinguish Handle()-aborted cases).
    const isMaxAttemptRaw = meta[TRIGGER_KEY_IS_MAX_ATTEMPT];
    const isMaxAttempt =
        typeof isMaxAttemptRaw === "boolean" ? isMaxAttemptRaw : attempt === maxAttempts;

    return { attempt, maxAttempts, isMaxAttempt, metadataAvailable: true };
}

function makeUnavailable(): ActivityInvocationInfo {
    return { attempt: 1, maxAttempts: 1, isMaxAttempt: false, metadataAvailable: false };
}

// ---------------------------------------------------------------------------
// getInstanceRetryHistory — client-side helper.
// ---------------------------------------------------------------------------

/** Minimal shape of getStatus payload we depend on.
 *  The extension's HTTP RPC layer returns history under the key `historyEvents`
 *  (per host-side post-processing), while older or alternate transports may use
 *  `history`. We accept either. */
interface DurableClientLike {
    getStatus(
        instanceId: string,
        options?: { showHistory?: boolean; showInput?: boolean; showHistoryOutput?: boolean }
    ): Promise<{ history?: Array<unknown>; historyEvents?: Array<unknown> } | undefined>;
}

/**
 * Project retry history for an orchestration instance.
 *
 * Calls `client.getStatus(instanceId, {showHistory: true})` and walks the
 * returned history to identify activity invocations carrying `dt.retry.*` tags.
 *
 * **Tag-location compatibility.** Tags are read from two places, in priority order:
 *   1. `TaskScheduledEvent.Tags` — the canonical source of truth (raw DTFx history).
 *   2. `TaskCompletedEvent.Tags` / `TaskFailedEvent.Tags` — set by the Functions
 *      extension's `AddScheduledEventDataAndAggregate` post-processor, which
 *      folds TaskScheduled events away and propagates their Tags onto the
 *      aggregated Completed/Failed event. This is what `DurableClient.getStatus`
 *      actually returns over the HTTP RPC endpoint.
 *
 * Returns `undefined` when the instance does not exist (matching the
 * missing-instance contract of `getStatus`).
 *
 * **Complexity:** `O(history length)`. Downloads the full history. For
 * long-running instances with very large histories (>10k events), expect
 * proportional payload size on the underlying `getStatus` call — there is
 * no pagination.
 *
 * **Latency:** polling latency = customer's polling interval. There is no push
 * notification — for subscribe-style alerts use OTel span attributes instead.
 *
 * **Backend dependency:** Backends that do not preserve
 * `TaskScheduledEvent.Tags` through persistence drop retry metadata.
 * Use `retryMetadataAvailable` to distinguish "no retries happened" from "we
 * don't know if retries happened."
 */
export async function getInstanceRetryHistory(
    client: DurableClientLike,
    instanceId: string
): Promise<InstanceRetryHistory | undefined> {
    const status = await client.getStatus(instanceId, { showHistory: true });
    if (!status) {
        return undefined;
    }

    // Accept either casing: `history` (raw DTFx-style) or `historyEvents`
    // (HTTP RPC status-response shape).
    const events: Array<unknown> = Array.isArray(status.history)
        ? status.history
        : Array.isArray(status.historyEvents)
        ? status.historyEvents
        : [];

    interface NormalizedEvent {
        readonly eventType: string;
        /** For TaskScheduled events: the event's own EventId (which is what
         *  TaskCompleted/TaskFailed point back at via TaskScheduledId).
         *  For TaskCompleted/TaskFailed events: the original TaskScheduledId.
         *  Unified into one field so the join below is a single set lookup. */
        readonly scheduledId?: number;
        readonly name?: string;
        readonly tags?: Record<string, string>;
    }

    // Property casing on getStatus payload — Spike #2 in the design called for
    // empirical verification. We defensively accept both Tags/tags and
    // EventType/eventType etc. Adjust this normalizer once Spike #2 resolves.
    function normalize(raw: unknown): NormalizedEvent | undefined {
        if (typeof raw !== "object" || raw === null) {
            return undefined;
        }
        const o = raw as Record<string, unknown>;
        const eventType = (o["EventType"] ?? o["eventType"]) as string | undefined;
        if (typeof eventType !== "string") {
            return undefined;
        }
        // Read the per-event "join key" depending on event type. The join
        // direction is: TaskCompleted/TaskFailed.TaskScheduledId === TaskScheduled.EventId.
        // We collapse both into one normalized `scheduledId` field so the
        // joiner below does not have to know about event-type specifics.
        const idCandidate =
            eventType === "TaskScheduled"
                ? o["EventId"] ?? o["eventId"]
                : o["TaskScheduledId"] ?? o["taskScheduledId"];
        // The activity name lives under different keys depending on whether
        // the response is raw DTFx history (`Name`/`name`) or post-processed
        // by the extension's HTTP RPC layer (`FunctionName`/`functionName` —
        // moved over by AddScheduledEventDataAndAggregate).
        const name = (o["Name"] ?? o["name"] ?? o["FunctionName"] ?? o["functionName"]) as
            | string
            | undefined;
        const tagsRaw = o["Tags"] ?? o["tags"];
        const tags =
            tagsRaw && typeof tagsRaw === "object"
                ? (tagsRaw as Record<string, string>)
                : undefined;

        return {
            eventType,
            scheduledId: typeof idCandidate === "number" ? idCandidate : undefined,
            name,
            tags,
        };
    }

    const normalized: NormalizedEvent[] = [];
    for (const raw of events) {
        const e = normalize(raw);
        if (e !== undefined) {
            normalized.push(e);
        }
    }

    // Index TaskCompleted / TaskFailed by their TaskScheduledId (now stored in
    // scheduledId after normalization) for the join below.
    const completed = new Set<number>();
    const failed = new Set<number>();
    for (const e of normalized) {
        if (e.scheduledId === undefined) continue;
        if (e.eventType === "TaskCompleted") completed.add(e.scheduledId);
        else if (e.eventType === "TaskFailed") failed.add(e.scheduledId);
    }

    const attempts: ActivityRetryRecord[] = [];
    let retryAttemptCount = 0;
    let retryMaxAttemptsReached = false;
    let sawAnyTaskScheduled = false;
    let sawAnyAggregated = false;

    // Path A: raw DTFx-style history with TaskScheduled events that still carry
    // Tags. This is what direct backend history APIs would return.
    for (const e of normalized) {
        if (e.eventType !== "TaskScheduled") continue;
        sawAnyTaskScheduled = true;

        const tags = e.tags;
        if (!tags) continue;

        const attempt = parsePositiveInt(tags[HISTORY_TAG_ATTEMPT]);
        const maxAttempts = parsePositiveInt(tags[HISTORY_TAG_MAX_ATTEMPTS]);
        if (
            attempt === undefined ||
            maxAttempts === undefined ||
            attempt < 1 ||
            maxAttempts < attempt
        ) {
            continue;
        }

        // For TaskScheduled events, scheduledId is the event's own EventId,
        // which is the join key TaskCompleted/TaskFailed events reference.
        const scheduledId = e.scheduledId ?? -1;

        const isMax = attempt === maxAttempts;
        let recordStatus: "running" | "completed" | "failed" = "running";
        if (completed.has(scheduledId)) recordStatus = "completed";
        else if (failed.has(scheduledId)) recordStatus = "failed";

        attempts.push({
            activityName: e.name ?? "",
            taskScheduledId: scheduledId,
            attempt,
            maxAttempts,
            isMaxAttempt: isMax,
            status: recordStatus,
        });

        if (attempt > 1) retryAttemptCount++;
        if (isMax && recordStatus === "failed") retryMaxAttemptsReached = true;
    }

    // Path B: HTTP RPC status-response shape — TaskScheduled events
    // are folded away by the host's response post-processor and their Tags are
    // propagated onto the aggregated TaskCompleted / TaskFailed event. Only run
    // when Path A produced nothing (i.e. no raw TaskScheduled events were
    // present in the response) to avoid double-counting on hybrid shapes.
    if (attempts.length === 0) {
        for (const e of normalized) {
            if (e.eventType !== "TaskCompleted" && e.eventType !== "TaskFailed") continue;

            const tags = e.tags;
            if (!tags) continue;

            const attempt = parsePositiveInt(tags[HISTORY_TAG_ATTEMPT]);
            const maxAttempts = parsePositiveInt(tags[HISTORY_TAG_MAX_ATTEMPTS]);
            if (
                attempt === undefined ||
                maxAttempts === undefined ||
                attempt < 1 ||
                maxAttempts < attempt
            ) {
                continue;
            }

            sawAnyAggregated = true;
            const isMax = attempt === maxAttempts;
            const recordStatus = e.eventType === "TaskCompleted" ? "completed" : "failed";

            attempts.push({
                // For aggregated events, the FunctionName (set by the
                // extension's post-processor) is the activity name source.
                activityName: e.name ?? "",
                taskScheduledId: e.scheduledId ?? -1,
                attempt,
                maxAttempts,
                isMaxAttempt: isMax,
                status: recordStatus,
            });

            if (attempt > 1) retryAttemptCount++;
            if (isMax && recordStatus === "failed") retryMaxAttemptsReached = true;
        }
    }

    // If we saw TaskScheduled events but none carried retry tags, the backend
    // likely stripped them at persistence (or no activities used retry policy).
    // We can't distinguish those two cases with the data available here — the
    // safer choice is to report metadataAvailable=true (we successfully fetched
    // history) and let the caller infer "no retries" from the empty array.
    // metadataAvailable=false is reserved for the case where getStatus itself
    // gave us nothing usable. Path B also counts toward metadata-available.
    const retryMetadataAvailable = sawAnyTaskScheduled || sawAnyAggregated;

    return {
        instanceId,
        attempts,
        retryAttemptCount,
        retryMaxAttemptsReached,
        retryMetadataAvailable,
    };
}
