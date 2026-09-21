import { z } from "zod";
import { zCountryLocaleFields } from "../../../../schema/common.ts";

/**
 * Request body of `POST /v3/ai_optimization/llm_mentions/target_metrics/live` — the vendor's fields as
 * documented (docs.dataforseo.com, OpenAPI 89d7d681 2026-09-20); only
 * optionality, no defaults. Callback and queue fields (`postback_url`,
 * `pingback_url`, `postback_data`, `tag`, `priority`) are deliberately
 * absent — the object is strict, so they are rejected before any spend.
 */
export const zAiMentionsTargetMetricsBody = z.object({
    target: z.array(z.record(z.string(), z.any())).min(1).max(20).describe(
        "Targets to search for: objects with keyword (brand, name, or domain) and search_scope ['question'|'answer'|'reference']; up to 20.",
    ),
    ...zCountryLocaleFields,
    platform: z.string().min(1).describe(
        "Target platform (values: chat_gpt, google)",
    ).optional(),
    initial_dataset_filters: z.array(z.record(z.string(), z.any()))
        .describe(
            "Array of filter expressions applied before aggregation",
        ).optional(),
    internal_list_limit: z.number().int().max(10).describe(
        "Maximum number of elements within internal arrays (default 10; max 10)",
    ).optional(),
}).strict();
