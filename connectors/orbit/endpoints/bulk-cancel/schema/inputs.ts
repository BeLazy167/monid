import { z } from "zod";

export const zBulkCancelPathParams = z.object({
    job_id: z.uuid().describe("The `job_id` the bulk submission returned."),
});
