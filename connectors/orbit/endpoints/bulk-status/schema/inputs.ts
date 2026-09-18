import { z } from "zod";

export const zBulkJobPathParams = z.object({
    job_id: z.uuid().describe("The `job_id` the bulk submission returned."),
});
