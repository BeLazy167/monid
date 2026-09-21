import { z } from "zod";
import { zLocaleFields } from "../../../../schema/common.ts";

/**
 * Request body of `POST /v3/business_data/google/hotel_info/live/advanced` — the vendor's fields as
 * documented (docs.dataforseo.com, OpenAPI 89d7d681 2026-09-20); only
 * optionality, no defaults. Callback and queue fields (`postback_url`,
 * `pingback_url`, `postback_data`, `tag`, `priority`) are deliberately
 * absent — the object is strict, so they are rejected before any spend.
 */
export const zGoogleHotelsInfoBody = z.object({
    hotel_identifier: z.string().min(1).describe(
        "Unique hotel identifier (e.g. ChYIq6SB--i6p6cpGgovbS8wN2s5ODZfEAE)",
    ),
    ...zLocaleFields,
    check_in: z.string().min(1).describe("Check-in date").optional(),
    check_out: z.string().min(1).describe("Check-out date").optional(),
    currency: z.string().min(1).describe("Currency").optional(),
    adults: z.number().int().describe("Number of adults (e.g. 1)").optional(),
    children: z.array(z.string().min(1)).describe(
        "Number and age of children",
    ).optional(),
    load_prices_by_dates: z.boolean().describe(
        "Load hotel stay prices by dates",
    ).optional(),
    prices_start_date: z.string().min(1).describe(
        "Start date to load prices by dates (e.g. 2025-05-20)",
    ).optional(),
    prices_end_date: z.string().min(1).describe(
        "End date to load prices by dates (e.g. 2025-05-21)",
    ).optional(),
    prices_date_range: z.string().min(1).describe(
        "Predefined period for retrieving daily price data (default month; values: month, three_months, six_months, year)",
    ).optional(),
}).strict();
