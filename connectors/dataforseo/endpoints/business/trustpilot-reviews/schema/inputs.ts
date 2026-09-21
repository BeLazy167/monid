import { z } from "zod";

/**
 * Request body of `POST /v3/business_data/trustpilot/reviews/task_post` — the vendor's fields as
 * documented (docs.dataforseo.com, OpenAPI 89d7d681 2026-09-20); only
 * optionality, no defaults. Callback and queue fields (`postback_url`,
 * `pingback_url`, `postback_data`, `tag`, `priority`) are deliberately
 * absent — the object is strict, so they are rejected before any spend.
 */
export const zTrustpilotReviewsBody = z.object({
    domain: z.string().min(1).max(255).describe(
        "Company domain as listed on Trustpilot, e.g. 'www.apple.com'.",
    ),
    sort_by: z.string().min(1).describe(
        "Results sorting parameter (default relevance)",
    ).optional(),
    depth: z.number().int().max(200).describe(
        "Parsing depth (default 20 maximum value: 200 Your account will be billed per each SERP containing up to 20 results; max 200)",
    ).optional(),
}).strict();
