import { z } from "zod";
import { personQueryShape } from "../../../schema/person-query.ts";

/**
 * `POST /v3/search/bulk` — the faithful mirror of the published v3
 * `BulkSearchRequest` (design D25): optionality only. Orbit's per-item
 * defaults are applied at the BINDING in endpoint.ts, so the estimate reads
 * concrete numbers for every row.
 *
 * An item is one search: the single-search shape minus `request_id` (which
 * belongs to the whole job) plus the caller's own `id`. That `id` is what
 * makes this the CSV endpoint — it comes back on the matching result row, so
 * a caller keys results straight back to their source rows.
 */
export const zBulkSearchItem = z.object({
    id: z.string().min(1).max(128).describe(
        "Your own id for this row — a CSV row number, a CRM record id. It " +
            "is returned on the matching result, and it is unique within " +
            "the job.",
    ),
    ...personQueryShape,
});

export const zBulkSearchBody = z.object({
    request_id: z.string().min(1).max(128).describe(
        "The job's idempotency key. Resubmitting the same key with the same " +
            "items returns the original job; changing the items answers " +
            "`409 bulk_search_idempotency_conflict`.",
    ),
    items: z.array(zBulkSearchItem).min(1).max(5000).describe(
        "1 to 5,000 searches. The whole body is capped at 8 MiB and each " +
            "item at 32 KiB.",
    ),
});
