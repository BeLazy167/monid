import { z } from "zod";

export const zBulkResultsPathParams = z.object({
    job_id: z.uuid().describe("The `job_id` the bulk submission returned."),
});

export const zBulkResultsQueryParams = z.object({
    offset: z.number().int().min(0).max(5000).optional().describe(
        "Where to start in the original input order. Each page carries at " +
            "most ten items and the `next_offset` to pass back.",
    ),
});
