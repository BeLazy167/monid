import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zBulkCancelPathParams } from "./schema/inputs.ts";

/**
 * `POST /v3/search/bulk/{job_id}/cancel` — stop the rows that have yet to run.
 *
 * The same call `orbit#v3/search/bulk`'s `stop` phase makes when a run hits
 * its budget, exposed so a caller can stop a job they started themselves —
 * a CSV submitted with the wrong column, a list that turned out too broad.
 *
 * FREE, and it cancels UNDISPATCHED items only: rows already processing carry
 * on to their outcome, and the job still owes for what it ran.
 */
export default defineEndpoint({
    meta: {
        displayName: "Cancel a Bulk Search",
        summary: "Stop the rows of a bulk job that have yet to start.",
        description: "Cancel the undispatched rows of a bulk people-search " +
            "job — the way to stop a list submitted in error before it runs " +
            "in full. Rows already processing continue to their outcome and " +
            "the job still settles what it ran; the response is the job in " +
            "its new state, with `cancel_requested` set and the counts and " +
            "consumed credits as they stand. The job ends `canceled`, and " +
            "its finished rows stay readable through " +
            "`orbit#v3/search/bulk/{job_id}/results`. Free.",
        docsUrl: "https://docs.orbitsearch.com/api/search/bulk-search",
        categories: ["people-enrichment"],
    },
    request: { method: "POST", path: "/v3/search/bulk/{job_id}/cancel" },
    input: { schema: { pathParams: zBulkCancelPathParams } },
    timeouts: { requestMs: 30_000, runMs: 60_000 },
    usage: {
        model: { kind: UsageModelKind.FREE },
        /** The cancel response is the JOB, consumed total and all — the same
         *  re-bill trap the status read carries. */
        consolidate: ({ data }) => ({ credits: {}, output: data.output }),
    },
});
