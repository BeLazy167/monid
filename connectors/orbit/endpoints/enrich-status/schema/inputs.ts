import { z } from "zod";

export const zEnrichStatusPathParams = z.object({
    request_id: z.string().min(1).describe(
        "The `request_id` an enrichment returned.",
    ),
});
