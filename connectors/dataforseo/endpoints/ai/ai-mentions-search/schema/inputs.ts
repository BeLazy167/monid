import { z } from "zod";
import {
    zCountryLocaleFields,
    zFilters,
    zLimit,
    zOffset,
    zOrderBy,
} from "../../../../schema/common.ts";

/**
 * Request body of `POST /v3/ai_optimization/llm_mentions/search_mentions/live` — the vendor's fields as
 * documented (docs.dataforseo.com, OpenAPI 89d7d681 2026-09-20); only
 * optionality, no defaults. Callback and queue fields (`postback_url`,
 * `pingback_url`, `postback_data`, `tag`, `priority`) are deliberately
 * absent — the object is strict, so they are rejected before any spend.
 */
export const zAiMentionsSearchBody = z.object({
    target: z.array(z.record(z.string(), z.any())).min(1).max(20).describe(
        "Targets to search for: objects with keyword (brand, name, or domain) and search_scope ['question'|'answer'|'reference']; up to 20.",
    ),
    ...zCountryLocaleFields,
    platform: z.string().min(1).describe(
        "Target platform (values: chat_gpt, google)",
    ).optional(),
    filters: zFilters,
    order_by: zOrderBy,
    offset: zOffset,
    search_after_token: z.string().min(1).describe(
        "Token for subsequent requests",
    ).optional(),
    limit: zLimit(1000, 100),
}).strict();
