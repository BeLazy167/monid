import { z } from "zod";
import { zDepth, zLocaleFields } from "../../../../schema/common.ts";

/**
 * Request body of `POST /v3/business_data/google/hotel_searches/live` — the vendor's fields as
 * documented (docs.dataforseo.com, OpenAPI 89d7d681 2026-09-20); only
 * optionality, no defaults. Callback and queue fields (`postback_url`,
 * `pingback_url`, `postback_data`, `tag`, `priority`) are deliberately
 * absent — the object is strict, so they are rejected before any spend.
 */
export const zGoogleHotelsSearchBody = z.object({
    keyword: z.string().min(1).describe("Keyword").optional(),
    ...zLocaleFields,
    search_this_area: z.boolean().describe(
        "Show hotels from the displayed area (default true; values: true, false)",
    ).optional(),
    depth: zDepth(140, 20, 20),
    check_in: z.string().min(1).describe("Check-in date").optional(),
    check_out: z.string().min(1).describe("Check-out date").optional(),
    currency: z.string().min(1).describe("Currency").optional(),
    adults: z.number().int().describe("Number of adults (e.g. 1)").optional(),
    children: z.array(z.string().min(1)).describe(
        "Number and age of children",
    ).optional(),
    stars: z.array(z.string().min(1)).describe("Hotel stars").optional(),
    min_rating: z.number().describe("Minimum rating (e.g. 2.5)").optional(),
    sort_by: z.string().min(1).describe(
        "Results sorting parameters (default relevance)",
    ).optional(),
    min_price: z.number().int().describe(
        "Minimum price per night (e.g. 100)",
    ).optional(),
    max_price: z.number().int().describe(
        "Maximum price per night (e.g. 600)",
    ).optional(),
    free_cancellation: z.boolean().describe(
        "Hotels with a free cancellation (default false)",
    ).optional(),
    is_vacation_rentals: z.boolean().describe(
        "Search for vacation rentals (default false)",
    ).optional(),
    amenities: z.array(z.string().min(1)).describe(
        "Hotel amenities (values: `'air_conditioning', 'all_inclusive_available', 'bar', 'free_breakfast', \u2026)",
    ).optional(),
}).strict();
