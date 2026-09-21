import { z } from "zod";
import { zCountryLocaleFields } from "../../../../schema/common.ts";

/**
 * Request body of `POST /v3/ai_optimization/llm_mentions/timeseries_delta/live` — the vendor's fields as
 * documented (docs.dataforseo.com, OpenAPI 89d7d681 2026-09-20); only
 * optionality, no defaults. Callback and queue fields (`postback_url`,
 * `pingback_url`, `postback_data`, `tag`, `priority`) are deliberately
 * absent — the object is strict, so they are rejected before any spend.
 */
export const zAiMentionsTimeseriesDeltaBody = z.object({
    target: z.array(z.record(z.string(), z.any())).min(1).max(20).describe(
        "Targets to search for: objects with keyword (brand, name, or domain) and search_scope ['question'|'answer'|'reference']; up to 20.",
    ),
    date_from: z.string().min(1).describe("Start date of the time range"),
    date_to: z.string().min(1).describe("End date of the time range"),
    group_range: z.string().min(1).describe(
        "Timeseries delta range (values: day, week, month, year)",
    ),
    ...zCountryLocaleFields,
    platform: z.string().min(1).describe(
        "Target platform (default google; values: chat_gpt, google)",
    ).optional(),
}).strict();
