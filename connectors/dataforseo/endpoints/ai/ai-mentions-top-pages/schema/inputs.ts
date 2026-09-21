import { z } from "zod";
import {
    zCountryLocaleFields,
    zFilters,
    zLimit,
    zOffset,
    zOrderBy,
} from "../../../../schema/common.ts";

/**
 * Request body of `POST /v3/ai_optimization/llm_mentions/top_mentioned_pages/live` — the vendor's fields as
 * documented (docs.dataforseo.com, OpenAPI 89d7d681 2026-09-20); only
 * optionality, no defaults. Callback and queue fields (`postback_url`,
 * `pingback_url`, `postback_data`, `tag`, `priority`) are deliberately
 * absent — the object is strict, so they are rejected before any spend.
 */
export const zAiMentionsTopPagesBody = z.object({
    target: z.array(z.record(z.string(), z.any())).min(1).max(20).describe(
        "Targets to search for: objects with keyword (brand, name, or domain) and search_scope ['question'|'answer'|'reference']; up to 20.",
    ),
    ...zCountryLocaleFields,
    platform: z.string().min(1).describe(
        "Target platform (values: chat_gpt, google)",
    ).optional(),
    links_scope: z.string().min(1).describe(
        "Links source scope (default sources; values: sources, search_results)",
    ).optional(),
    filters: zFilters,
    initial_dataset_filters: z.array(z.record(z.string(), z.any()))
        .describe(
            "Array of filter expressions applied before aggregation",
        ).optional(),
    limit: zLimit(1000, 100),
    internal_list_limit: z.number().int().max(10).describe(
        "Maximum number of elements within internal arrays (default 5; max 10)",
    ).optional(),
    order_by: zOrderBy,
    offset: zOffset,
    include_pages: z.array(z.string().min(1)).describe(
        "Array of pages to include in the response",
    ).optional(),
    exclude_pages: z.array(z.string().min(1)).describe(
        "Array of pages to exclude from the response",
    ).optional(),
}).strict();
