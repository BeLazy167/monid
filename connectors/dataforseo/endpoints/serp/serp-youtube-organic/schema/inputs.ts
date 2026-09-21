import { z } from "zod";
import { zDepth, zLocaleFields } from "../../../../schema/common.ts";

/**
 * Request body of `POST /v3/serp/youtube/organic/live/advanced` — the vendor's fields as
 * documented (docs.dataforseo.com, OpenAPI 89d7d681 2026-09-20); only
 * optionality, no defaults. Callback and queue fields (`postback_url`,
 * `pingback_url`, `postback_data`, `tag`, `priority`) are deliberately
 * absent — the object is strict, so they are rejected before any spend.
 */
export const zSerpYoutubeOrganicBody = z.object({
    ...zLocaleFields,
    keyword: z.string().min(1).max(700).describe(
        "Search query, up to 700 characters.",
    ),
    depth: zDepth(700, 20, 20),
    device: z.enum(["desktop", "mobile"]).describe(
        "Device type (default desktop).",
    ).optional(),
}).strict();
