import { z } from "zod";
import {
    zCountryLocaleFields,
    zFilters,
    zLimit,
    zOrderBy,
} from "../../../../schema/common.ts";

/**
 * Request body of `POST /v3/ai_optimization/llm_mentions/multi_target_metrics/live` — the vendor's fields as
 * documented (docs.dataforseo.com, OpenAPI 89d7d681 2026-09-20); only
 * optionality, no defaults. Callback and queue fields (`postback_url`,
 * `pingback_url`, `postback_data`, `tag`, `priority`) are deliberately
 * absent — the object is strict, so they are rejected before any spend.
 */
export const zAiMentionsMultiTargetMetricsBody = z.object({
    targets: z.array(z.record(z.string(), z.any())).min(1).max(20).describe(
        "Target groups to compare; each an object with keyword and search_scope; up to 20.",
    ),
    ...zCountryLocaleFields,
    platform: z.string().min(1).describe(
        "Target platform (default google; values: chat_gpt, google)",
    ).optional(),
    filters: zFilters,
    initial_dataset_filters: z.array(z.record(z.string(), z.any()))
        .describe(
            "Array of filter expressions applied before aggregation",
        ).optional(),
    order_by: zOrderBy,
    limit: zLimit(1000, 100),
    offset: z.number().int().describe(
        "Offset in the results array of the returned mentions data (default 0)",
    ).optional(),
    internal_list_limit: z.number().int().max(10).describe(
        "Maximum number of elements within internal arrays (default 5; max 10)",
    ).optional(),
}).strict();
