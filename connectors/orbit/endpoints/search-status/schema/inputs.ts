import { z } from "zod";

export const zSearchStatusPathParams = z.object({
    search_id: z.string().min(1).describe(
        "The `search_id` the search returned.",
    ),
});
