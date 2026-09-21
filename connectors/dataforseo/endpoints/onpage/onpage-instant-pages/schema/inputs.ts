import { z } from "zod";

/**
 * Request body of `POST /v3/on_page/instant_pages` — the vendor's fields as
 * documented (docs.dataforseo.com, OpenAPI 89d7d681 2026-09-20); only
 * optionality, no defaults. Callback and queue fields (`postback_url`,
 * `pingback_url`, `postback_data`, `tag`, `priority`) are deliberately
 * absent — the object is strict, so they are rejected before any spend.
 */
export const zOnpageInstantPagesBody = z.object({
    url: z.url().describe("Page URL to fetch, including the scheme."),
    custom_user_agent: z.string().min(1).describe(
        "Custom user agent (default Mozilla/5; e.g. Mozilla/5.0)",
    ).optional(),
    browser_preset: z.string().min(1).describe(
        "Browser preset (values: desktop, mobile, \u2026)",
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
    store_raw_html: z.boolean().describe(
        "Store raw html (default false)",
    ).optional(),
    accept_language: z.string().min(1).describe("Accept language").optional(),
    load_resources: z.boolean().describe(
        "Load resources (default falseNote:)",
    ).optional(),
    enable_browser_rendering: z.boolean().describe(
        "Enable browser rendering (default falseset to true to obtain Core Web Vitals (FID, CLS, LCP) metrics in)",
    ).optional(),
    disable_cookie_popup: z.boolean().describe(
        "Disable cookie popup (default false)",
    ).optional(),
    return_despite_timeout: z.boolean().describe(
        "Return despite timeout (default false)",
    ).optional(),
    enable_javascript: z.boolean().describe(
        "Enable javascript (default falseNote:)",
    ).optional(),
    enable_xhr: z.boolean().describe("Enable xhr (default falseif)").optional(),
    custom_js: z.string().min(1).describe("Custom js").optional(),
    validate_micromarkup: z.boolean().describe(
        "Validate micromarkup (default false)",
    ).optional(),
    check_spell: z.boolean().describe("Check spell (default false)").optional(),
    checks_threshold: z.record(z.string(), z.any()).describe(
        "Checks threshold",
    ).optional(),
    switch_pool: z.boolean().describe("Switch pool").optional(),
    ip_pool_for_scan: z.string().min(1).describe(
        "Ip pool for scan (values: us, de)",
    ).optional(),
}).strict();
