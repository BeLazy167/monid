import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zBulkJobPathParams } from "./schema/inputs.ts";

/**
 * `GET /v3/search/bulk/{job_id}` — read a bulk job.
 *
 * The same read the engine's poll makes on every tick, exposed so a caller
 * can follow a job themselves, resume one started elsewhere, or check what a
 * job consumed after the fact.
 *
 * FREE. "Retrying a job or reading its saved results does not repeat its
 * search charges" — and this must stay free for a second reason: the body
 * repeats the WHOLE JOB's `billing.consumed_credits` on every read, so
 * inheriting a vendor-claim settle here would re-bill the entire job each
 * time a caller checked on it.
 */
export default defineEndpoint({
    meta: {
        displayName: "Get Bulk Search Status",
        summary: "Read a bulk job: its progress, counts and credits consumed.",
        description: "Read a bulk people-search job by id — its status, how " +
            "many rows are completed, failed, cancelled and pending, and " +
            "the credits it has consumed and reserved so far. `status` is " +
            "`queued` or `running` while work continues, " +
            "`waiting_for_credits` when the billing account needs a top-up " +
            "(the job resumes by itself once it has one), `needs_attention` " +
            "while automatic recovery retries, then `completed`, " +
            "`completed_with_errors`, or `canceled`. Temporary problems show " +
            "in `last_error` while the job retries them. Read the rows " +
            "themselves with `orbit#v3/search/bulk/{job_id}/results`. Free.",
        docsUrl: "https://docs.orbitsearch.com/api/search/bulk-search",
        categories: ["people-enrichment"],
    },
    request: { method: "GET", path: "/v3/search/bulk/{job_id}" },
    input: { schema: { pathParams: zBulkJobPathParams } },
    timeouts: { requestMs: 30_000, runMs: 60_000 },
    usage: {
        model: { kind: UsageModelKind.FREE },
        /** MUST stay empty. A job status body repeats the whole job's
         *  consumed total on every read; a claim here would re-bill it. */
        consolidate: ({ data }) => ({ credits: {}, output: data.output }),
    },
});
