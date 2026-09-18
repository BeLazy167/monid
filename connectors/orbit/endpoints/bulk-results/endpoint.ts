import { defineEndpoint, UsageModelKind } from "@shared/core";
import {
    zBulkResultsPathParams,
    zBulkResultsQueryParams,
} from "./schema/inputs.ts";

/**
 * `GET /v3/search/bulk/{job_id}/results` — read the rows.
 *
 * `orbit#v3/search/bulk` runs the job and settles its bill; this is where the
 * answers are. Orbit pages them ten at a time in the caller's ORIGINAL input
 * order, unfinished rows included, so a caller can walk the whole table and
 * revisit the pages that were still working.
 *
 * FREE. The searches were billed by the job that ran them, and a caller
 * paging 5,000 rows makes 500 of these calls.
 */
export default defineEndpoint({
    meta: {
        displayName: "Read Bulk Search Results",
        summary: "Read a bulk job's rows, ten per page, in your input order.",
        description: "Read the results of a bulk people search, ten rows per " +
            "page. Every row carries YOUR `id` — the CSV row number or CRM " +
            "record id you submitted — plus its zero-based `index`, its own " +
            "`status`, and `result`: a full search snapshot with the person " +
            "found and their profile. Pages follow your original input " +
            "order and include rows that are still working, so walk the " +
            "table with `next_offset` and revisit unfinished pages once the " +
            "job advances. Rows publish in small groups as their billing " +
            "settles. Free — the job already paid for the searches, so page " +
            "the whole table as often as you need.",
        docsUrl: "https://docs.orbitsearch.com/api/search/bulk-search",
        categories: ["people-enrichment"],
    },
    request: { method: "GET", path: "/v3/search/bulk/{job_id}/results" },
    input: {
        schema: {
            pathParams: zBulkResultsPathParams,
            queryParams: zBulkResultsQueryParams,
        },
    },
    timeouts: { requestMs: 60_000, runMs: 90_000 },
    usage: { model: { kind: UsageModelKind.FREE } },
});
