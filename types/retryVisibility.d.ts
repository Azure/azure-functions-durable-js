import { InvocationContext } from "@azure/functions";
import { DurableClient } from "./durableClient";

/**
 * Per-attempt retry metadata for an activity invocation.
 * Returned by {@link getActivityInvocationInfo}.
 */
export interface ActivityInvocationInfo {
    /** 1-based attempt counter; defaults to 1 when metadata is unavailable. */
    readonly attempt: number;
    /** Policy ceiling (the `maxAttempts` value passed to `RetryOptions`);
     *  defaults to 1 when metadata is unavailable. */
    readonly maxAttempts: number;
    /**
     * True when the retry counter has reached the policy's `maxAttempts`
     * (i.e. `attempt === maxAttempts`). False when metadata is unavailable.
     *
     * NOTE: This does NOT mean "no further attempts will run." `RetryOptions.handle`
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

/**
 * One activity invocation record in an instance's projected retry history.
 * See {@link getInstanceRetryHistory}.
 */
export interface ActivityRetryRecord {
    readonly activityName: string;
    readonly taskScheduledId: number;
    readonly attempt: number;
    readonly maxAttempts: number;
    readonly isMaxAttempt: boolean;
    readonly status: "running" | "completed" | "failed";
}

/**
 * Projected retry history for an orchestration instance, returned by
 * {@link getInstanceRetryHistory}.
 */
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

/**
 * Read the current retry attempt information for an activity invocation.
 *
 * When the activity was scheduled with a `RetryOptions` policy AND the backend
 * preserves `TaskScheduledEvent.Tags` (currently DTS only), returns the parsed
 * attempt counter, policy ceiling, and an `isMaxAttempt` flag.
 *
 * When metadata is unavailable (no retry policy, non-DTS backend, parsing
 * failure), returns a fallback shape with `metadataAvailable: false`.
 *
 * NOTE: The `metadataAvailable` flag is the ONLY safe way to distinguish a genuine
 * first attempt from missing metadata. `info.attempt === 1` is true in both
 * cases.
 *
 * @example
 *   const info = getActivityInvocationInfo(context);
 *   if (info.metadataAvailable && info.attempt > 1) {
 *       context.log(`retry attempt ${info.attempt} of ${info.maxAttempts}`);
 *   }
 */
export function getActivityInvocationInfo(context: InvocationContext): ActivityInvocationInfo;

/**
 * Project retry history for an orchestration instance.
 *
 * Returns `undefined` when the instance does not exist (matches `DurableClient.getStatus`).
 * Walks the orchestration's history (downloaded via `getStatus`, O(history length)),
 * filters to `TaskScheduled` events carrying `dt.retry.*` tags, joins each to its
 * matching `TaskCompleted` / `TaskFailed` (or marks `"running"` if neither has
 * appeared yet), and returns the projection.
 *
 * Use `retryMetadataAvailable` to distinguish "no retries happened" from "we
 * don't know if retries happened."
 */
export function getInstanceRetryHistory(
    client: DurableClient,
    instanceId: string
): Promise<InstanceRetryHistory | undefined>;
