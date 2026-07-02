/**
 * Native activity retry visibility — helpers for inspecting per-attempt
 * retry metadata recorded on activity history events.
 *
 * Two helpers are exported from this module:
 *
 *  - `getActivityInvocationInfo(context)` — read from inside an activity to learn
 *    the current retry attempt and policy ceiling.
 *  - `getInstanceRetryHistory(client, instanceId)` — read from outside an orchestration
 *    to project the retry trail per activity.
 *
 * Both helpers share a single strict-decimal parser (see `parsePositiveInt`) so
 * that `dt.retry.*` history tags are interpreted identically on the activity side
 * and the client side.
 */

import type { InvocationContext } from "@azure/functions";

// ---------------------------------------------------------------------------
// Trigger metadata key constants — camelCase, `durabletask.` prefix.
// These key names must match the names written to the activity trigger
// metadata; renaming them here breaks reading that metadata.
// ---------------------------------------------------------------------------
const TRIGGER_KEY_ATTEMPT = "durabletask.attempt";
const TRIGGER_KEY_MAX_ATTEMPTS = "durabletask.maxAttempts";
const TRIGGER_KEY_IS_MAX_ATTEMPT = "durabletask.isMaxAttempt";

// History tag keys — these key names must match the tag names written to
// `TaskScheduledEvent.Tags`.
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
     * True when `attempt === maxAttempts`. False when metadata is unavailable.
     *
     * This only means the attempt reached the policy's ceiling, not that it was
     * the last one to run: if `retryTimeoutInMilliseconds` stops retries early,
     * the final attempt can have `isMaxAttempt === false`.
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
    /** Count of TaskScheduled events with attempt > 1. */
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
 * matching `^[1-9][0-9]*$` (or `"0"`); returns `undefined` otherwise. No
 * whitespace, signs, hex, or scientific notation. ASCII decimal only.
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

/** Internal test hook, exported under a deliberately-ugly name. NOT part of
 *  the public API. */
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
        maxAttempts < 1 ||
        maxAttempts < attempt
    ) {
        return makeUnavailable();
    }

    // Prefer the precomputed boolean when present; otherwise fall back to
    // comparing the attempt counter against maxAttempts.
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

/** Minimal shape of the getStatus payload we depend on.
 *  `DurableClient.getStatus` returns a `DurableOrchestrationStatus`, whose
 *  constructor already normalizes the two possible history keys (`history` and
 *  `historyEvents`) into a single `history` field. We therefore only depend on
 *  `history` here. */
interface DurableClientLike {
    getStatus(
        instanceId: string,
        options?: { showHistory?: boolean; showInput?: boolean; showHistoryOutput?: boolean }
    ): Promise<{ history?: Array<unknown> } | undefined>;
}

/**
 * Detects the "instance does not exist" signal from a thrown `getStatus` error.
 *
 * `DurableClient.getStatus` does not return `undefined` for a missing instance —
 * it throws when the status request returns HTTP 404. We recover that single case
 * and map it back to the documented "missing instance" contract (return
 * `undefined`), while letting every other error (e.g. HTTP 500) propagate.
 */
function isInstanceNotFoundError(error: unknown): boolean {
    if (typeof error !== "object" || error === null) {
        return false;
    }
    const e = error as { status?: unknown; statusCode?: unknown; message?: unknown };
    if (e.status === 404 || e.statusCode === 404) {
        return true;
    }
    return typeof e.message === "string" && /HTTP 404 response/.test(e.message);
}

/**
 * Project retry history for an orchestration instance.
 *
 * Calls `client.getStatus(instanceId, {showHistory: true})` and walks the
 * returned history to identify activity invocations carrying `dt.retry.*` tags.
 *
 * **Tag-location compatibility.** Tags are read from two places, in priority order:
 *   1. `TaskScheduledEvent.Tags` — the canonical source of truth in raw history.
 *   2. `TaskCompletedEvent.Tags` / `TaskFailedEvent.Tags` — some status responses
 *      fold the TaskScheduled events away and propagate their Tags onto the
 *      aggregated Completed/Failed event, so we read them there as well.
 *
 * Returns `undefined` when the instance does not exist. `getStatus` signals a
 * missing instance by throwing (HTTP 404); that throw is caught here and mapped
 * to `undefined`. All other errors propagate.
 *
 * **Complexity:** `O(history length)`. Downloads the full history. For
 * long-running instances with very large histories (>10k events), expect
 * proportional payload size on the underlying `getStatus` call — there is
 * no pagination.
 *
 * **Latency:** polling latency = the caller's polling interval. There is no push
 * notification.
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
    let status: Awaited<ReturnType<DurableClientLike["getStatus"]>>;
    try {
        status = await client.getStatus(instanceId, { showHistory: true });
    } catch (error) {
        // getStatus throws (HTTP 404) when the instance does not exist. Map that
        // to the documented missing-instance contract by returning undefined,
        // and re-throw anything else so genuine failures are not swallowed.
        if (isInstanceNotFoundError(error)) {
            return undefined;
        }
        throw error;
    }
    // A conforming test double may still return undefined for a missing instance.
    if (!status) {
        return undefined;
    }

    // `DurableOrchestrationStatus` already normalizes the `history`/`historyEvents`
    // keys into `history`, so we only read from there.
    const events: Array<unknown> = Array.isArray(status.history) ? status.history : [];

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

    // The getStatus payload may use either Pascal-case or camel-case property
    // names depending on the transport, so we defensively accept both
    // (Tags/tags, EventType/eventType, etc.).
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
        // The activity name lives under different keys depending on the
        // response shape: raw history uses `Name`/`name`, while aggregated
        // status responses use `FunctionName`/`functionName`.
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

    // Path A: raw history where TaskScheduled events still carry their Tags.
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
            maxAttempts < 1 ||
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

    // Path B: aggregated status-response shape — the TaskScheduled events are
    // folded away and their Tags are propagated onto the aggregated
    // TaskCompleted / TaskFailed event. Only run when Path A produced nothing
    // (i.e. no raw TaskScheduled events were present) to avoid double-counting
    // on hybrid shapes.
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
                maxAttempts < 1 ||
                maxAttempts < attempt
            ) {
                continue;
            }

            sawAnyAggregated = true;
            const isMax = attempt === maxAttempts;
            const recordStatus = e.eventType === "TaskCompleted" ? "completed" : "failed";

            attempts.push({
                // For aggregated events, the FunctionName is the activity name
                // source.
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
