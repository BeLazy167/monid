import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { z } from "zod";
import { zBulkSearchBody, zBulkSearchItem } from "./schema/inputs.ts";

/**
 * `POST /v3/search/bulk` — a spreadsheet of people, resolved as one job.
 *
 * THE CSV ENDPOINT. Orbit's own reference puts it plainly: "You do not need
 * to send or retry a separate HTTP request for every CSV row." Up to 5,000
 * searches ride one submission, each carrying the caller's own `id`, and that
 * id comes back on the matching result row — so a caller keys Orbit's answers
 * straight back to their source rows.
 *
 * ASYNC, and the ONE endpoint here whose bill is EXACT. Every other billed
 * endpoint in this connector derives its settle from observation, because
 * Orbit reports no meter on a search or a build. A bulk job does report one:
 * `billing.consumed_credits` is the vendor's own cumulative charge, and
 * `held_credits` the reservation beside it. Orbit "charges for the results
 * under the v3 pricing rules and releases unused credits", so at a terminal
 * status the consumed figure IS the bill — declared as a `usage.consolidate`
 * claim, which wins over the derived fold (design D27).
 *
 * THE JOB OUTLIVING THE RUN is the one hazard, and `stop` is the answer:
 * Orbit exposes a cancel route for undispatched items, so a run that hits its
 * budget cancels the work nobody will collect rather than leaving it to
 * charge on. Work already done still settles, which is why `canceled` is a
 * 200 outcome here and not an error.
 *
 * TWO STATUSES ARE SLOW, NOT FINISHED. `waiting_for_credits` means the
 * account needs a top-up and the job "resumes automatically";
 * `needs_attention` means automatic recovery is retrying "about every five
 * minutes". Both keep the run alive on a backed-off cadence — settling on
 * either would abandon a job that is still holding reserved credits.
 */
export default defineEndpoint({
    meta: {
        displayName: "Bulk People Search (CSV)",
        summary:
            "Resolve a whole spreadsheet of people — up to 5,000 rows as one job.",
        description: "Enrich a list of people in one call: up to 5,000 rows, " +
            "each resolved to a person and returned with deep, " +
            "source-backed context. THE endpoint for a CSV, a CRM export, a " +
            "prospect list, an attendee list, or any table of names, " +
            "emails, phone numbers, addresses or profile URLs. Every item " +
            "carries your own `id` — a CSV row number, a CRM record id — " +
            "and that id comes back on the matching result, so answers key " +
            "straight back to your rows without matching on names. Each " +
            "item takes the same inputs as a single search: `query`, " +
            "`intent`, `signals`, `profile_depth` and `limit`, set per row, " +
            "so one job can mix a plain-English lookup with an " +
            "email-to-person resolution. Orbit queues the work, retries " +
            "temporary failures itself, and reports one job status; this " +
            "endpoint follows it to completion and hands back the finished " +
            "job. Read the rows with `orbit#v3/search/bulk/{job_id}/results`, " +
            "ten per page, free. Priced per the v3 rules for what each row " +
            "actually returns — Orbit reserves credits as groups begin and " +
            "releases what it did not use, and the job reports its own " +
            "consumed total. Read `estimate` first: 5,000 full-depth rows " +
            "is a large number.",
        docsUrl: "https://docs.orbitsearch.com/api/search/bulk-search",
        categories: ["people-enrichment"],
    },
    request: { method: "POST", path: "/v3/search/bulk" },
    input: {
        schema: {
            // Orbit's documented per-item defaults, materialized at the
            // binding (D25 — the mirror carries optionality only) so the
            // estimate reads a concrete cap for every row.
            body: zBulkSearchBody.extend({
                items: z.array(zBulkSearchItem.extend({
                    candidate_discovery: zBulkSearchItem.shape
                        .candidate_discovery.unwrap().default(false),
                    candidate_discovery_limit: zBulkSearchItem.shape
                        .candidate_discovery_limit.unwrap().default(10),
                    profile_depth: zBulkSearchItem.shape.profile_depth.unwrap()
                        .default("partial"),
                    include_profile: zBulkSearchItem.shape.include_profile
                        .unwrap().default(true),
                    limit: zBulkSearchItem.shape.limit.unwrap().default(20),
                })).min(1).max(5000),
            }),
        },
    },
    /** Orbit asks callers to poll a bulk job "about every three seconds", and
     *  status reads have their own generous bucket (burst 30, five per
     *  second), so the cadence follows the vendor rather than the house
     *  default. 30 minutes is the whole-run budget; `stop` cancels what is
     *  left if a job outlives it. */
    timeouts: { requestMs: 120_000, runMs: 1_800_000, pollMs: 3_000 },
    lifecycle: {
        state: z.strictObject({
            statusPath: z.string().optional().describe(
                "The status route Orbit named in `links.status`.",
            ),
            cancelPath: z.string().optional().describe(
                "The cancel route Orbit named in `links.cancel`.",
            ),
        }),
        start: async ({ utils, logger }) => {
            const res = await utils.request();
            if (res.status < 200 || res.status >= 300) {
                // Orbit refused the submission — a full queue answers `409
                // bulk_search_queue_full` with `Retry-After`, a changed item
                // list under a used key answers `409
                // bulk_search_idempotency_conflict`, and an oversized body
                // answers `400`. All of it is DATA, zero-billed, and the
                // caller decides whether to run again.
                return {
                    kind: "COMPLETED",
                    httpStatus: res.status,
                    output: res.body,
                };
            }
            const jobId = utils.json.optionalGet(res.body, "$.job_id");
            if (typeof jobId !== "string" || jobId === "") {
                throw new Error("Orbit did not return a job_id");
            }
            const statusLink = utils.json.optionalGet(
                res.body,
                "$.links.status",
            );
            const cancelLink = utils.json.optionalGet(
                res.body,
                "$.links.cancel",
            );
            const statusPath =
                typeof statusLink === "string" && statusLink.charAt(0) === "/"
                    ? statusLink
                    : "/v3/search/bulk/" + encodeURIComponent(jobId);
            const cancelPath =
                typeof cancelLink === "string" && cancelLink.charAt(0) === "/"
                    ? cancelLink
                    : "/v3/search/bulk/" + encodeURIComponent(jobId) +
                        "/cancel";
            logger.info("orbit bulk search submitted", { jobId });
            return {
                kind: "RUNNING",
                state: {
                    externalRunId: jobId,
                    data: { statusPath, cancelPath },
                },
            };
        },
        poll: async ({ data, utils, logger }) => {
            const jobId = data.lifecycle.state.externalRunId;
            if (jobId === undefined) {
                throw Object.assign(
                    new Error("orbit bulk poll without externalRunId"),
                    { retriable: false },
                );
            }
            const previous = data.lifecycle.state.data;
            const res = await utils.http({
                method: "GET",
                path: previous?.statusPath ??
                    "/v3/search/bulk/" + encodeURIComponent(jobId),
            });
            if (res.status === 408 || res.status === 429 || res.status >= 500) {
                // The status LOOKUP failed, not the job — the same retry
                // class the rest of this connector holds, and the same
                // `Retry-After` rule. The job keeps processing and keeps
                // holding reserved credits.
                const after = Number(res.headers["retry-after"]);
                const pollAfterMs = Number.isFinite(after) && after > 0
                    ? Math.min(Math.max(after * 1000, 1_000), 120_000)
                    : 15_000;
                logger.warn("orbit bulk status lookup transient", {
                    jobId,
                    status: res.status,
                    pollAfterMs,
                });
                return { kind: "RUNNING", pollAfterMs };
            }
            if (res.status < 200 || res.status >= 300) {
                return {
                    kind: "COMPLETED",
                    httpStatus: res.status,
                    output: res.body,
                };
            }
            const status = utils.json.optionalGet(res.body, "$.status");
            if (status === "waiting_for_credits") {
                // The account ran dry. Orbit resumes the job by itself once
                // credits land, so the run stays open on a slow cadence
                // rather than abandoning a job still holding a reservation.
                logger.warn("orbit bulk job waiting for credits", { jobId });
                return { kind: "RUNNING", pollAfterMs: 60_000 };
            }
            if (status === "needs_attention") {
                // Automatic recovery retries about every five minutes; match
                // it rather than hammering a job that is already struggling.
                logger.warn("orbit bulk job needs attention", { jobId });
                return { kind: "RUNNING", pollAfterMs: 300_000 };
            }
            if (
                status === "queued" || status === "running" ||
                status === undefined
            ) {
                return { kind: "RUNNING" };
            }
            // `completed`, `completed_with_errors` and `canceled` all
            // DELIVERED rows and all carry a consumed total — a cancelled
            // job still owes for the items that ran, so every one of them
            // settles as the success it is.
            logger.info("orbit bulk job settled", {
                jobId,
                status: String(status),
            });
            return { kind: "COMPLETED", httpStatus: 200, output: res.body };
        },
        stop: async ({ data, utils, logger }) => {
            const jobId = data.lifecycle.state.externalRunId;
            if (jobId === undefined) return;
            const previous = data.lifecycle.state.data;
            const res = await utils.http({
                method: "POST",
                path: previous?.cancelPath ??
                    "/v3/search/bulk/" + encodeURIComponent(jobId) + "/cancel",
            });
            if (res.status < 200 || res.status >= 300) {
                // Best-effort teardown: a finished job answers non-2xx and
                // there is nothing left to cancel.
                logger.warn("orbit bulk cancel failed (ignored)", {
                    jobId,
                    status: res.status,
                });
            }
        },
    },
    usage: {
        /** Metered in Orbit's own credits, because the JOB reports one
         *  number: a bulk job settles a mix of cached blocks, discoveries
         *  and builds across thousands of rows, and Orbit totals it. */
        model: {
            kind: UsageModelKind.PER_UNIT,
            unit: Unit.CREDIT,
            consumes: { credit: "default", amount: 1 },
            label: "bulk search",
            description:
                "what the job's rows actually drew, as Orbit totalled it",
        },
        /** THE VENDOR'S OWN CLAIM (design D27), and the only exact one in
         *  this connector. `billing.consumed_credits` is the job's charge
         *  after Orbit "releases unused credits"; `held_credits` is the
         *  reservation and stays in the output as the job's own provenance.
         *  Omitted when absent, so the derived fold still answers. */
        consolidate: ({ data, utils }) => {
            const consumed = utils.json.optionalNum(
                data.output,
                "$.billing.consumed_credits",
            );
            return {
                credits: {
                    ...(consumed !== undefined ? { default: consumed } : {}),
                },
            };
        },
        /** The CEILING the caller authorized, summed over every row: each
         *  item's cached blocks plus a build for every person it may return.
         *  Rows settle far below it — the point of showing it is that 5,000
         *  full-depth rows is a four-figure number before anyone runs it. */
        estimate: ({ data }) => {
            let credits = 0;
            for (const item of data.input.body.items) {
                const discovered = item.candidate_discovery
                    ? item.candidate_discovery_limit
                    : 0;
                const rate = item.profile_depth === "full" ? 10 : 5;
                credits += Math.ceil(item.limit / 10) +
                    (item.limit + discovered) * rate;
            }
            return { counts: { CREDIT: credits } };
        },
        /** The job's own consumed total — the same figure the claim carries,
         *  so the fold agrees with the vendor rather than arguing with it. */
        evidence: ({ data, utils }) => {
            const consumed = utils.json.optionalNum(
                data.output,
                "$.billing.consumed_credits",
            );
            return {
                counts: consumed === undefined ? {} : { CREDIT: consumed },
            };
        },
    },
});
