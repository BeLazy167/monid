import { z } from "zod";

/**
 * Request body of `POST /v3/on_page/page_screenshot` — the vendor's fields as
 * documented (docs.dataforseo.com, OpenAPI 89d7d681 2026-09-20); only
 * optionality, no defaults. Callback and queue fields (`postback_url`,
 * `pingback_url`, `postback_data`, `tag`, `priority`) are deliberately
 * absent — the object is strict, so they are rejected before any spend.
 */
export const zOnpagePageScreenshotBody = z.object({
    url: z.url().describe("Page URL to fetch, including the scheme."),
    accept_language: z.string().min(1).describe(
        "Language header for accessing the website",
    ).optional(),
    custom_user_agent: z.string().min(1).describe(
        "Custom user agent (default Mozilla/5; e.g. Mozilla/5.0)",
    ).optional(),
    browser_preset: z.string().min(1).describe(
        "Preset for browser screen parameters (values: desktop, mobile, tablet desktop preset will apply the following values)",
    ).optional(),
    browser_screen_width: z.number().int().describe(
        "Browser screen width",
    ).optional(),
    browser_screen_height: z.number().int().describe(
        "Browser screen height",
    ).optional(),
    browser_screen_scale_factor: z.number().describe(
        "Browser screen scale factor (max 3)",
    ).optional(),
    full_page_screenshot: z.boolean().describe(
        "Take a screenshot of the full page (default true)",
    ).optional(),
    disable_cookie_popup: z.boolean().describe(
        "Disable the cookie popup (default false)",
    ).optional(),
    switch_pool: z.boolean().describe("Switch proxy pool").optional(),
    ip_pool_for_scan: z.string().min(1).describe(
        "Proxy pool (values: us, de)",
    ).optional(),
}).strict();
