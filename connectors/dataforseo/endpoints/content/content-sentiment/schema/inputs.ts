import { z } from "zod";

/**
 * Request body of `POST /v3/content_analysis/sentiment_analysis/live` — the vendor's fields as
 * documented (docs.dataforseo.com, OpenAPI 89d7d681 2026-09-20); only
 * optionality, no defaults. Callback and queue fields (`postback_url`,
 * `pingback_url`, `postback_data`, `tag`, `priority`) are deliberately
 * absent — the object is strict, so they are rejected before any spend.
 */
export const zContentSentimentBody = z.object({
    keyword: z.string().min(1).max(200).describe(
        "Keyword, phrase, or brand to find citations of.",
    ),
    keyword_fields: z.record(z.string(), z.any()).describe(
        "Keyword fields",
    ).optional(),
    page_type: z.array(z.string().min(1)).describe(
        "Page type (values: 'ecommerce', 'news', 'blogs', 'message-boards', 'organization')",
    ).optional(),
    internal_list_limit: z.number().int().max(20).describe(
        "Internal list limit (default 1 maximum value: 20; max 20)",
    ).optional(),
    positive_connotation_threshold: z.number().describe(
        "Positive connotation threshold (default 0; values: from 0 to 1)",
    ).optional(),
    sentiments_connotation_threshold: z.number().describe(
        "Sentiments connotation threshold (default 0; values: from 0 to 1)",
    ).optional(),
    initial_dataset_filters: z.array(z.record(z.string(), z.any()))
        .describe("Initial dataset filters").optional(),
    rank_scale: z.string().min(1).describe(
        "Rank scale (default one_thousand; values: one_hundred)",
    ).optional(),
}).strict();
