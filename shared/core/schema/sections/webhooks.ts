import { z } from "zod";
import {
    zResourceWebhookSubscribeFn,
    zWebhookCorrelateFn,
    zWebhookDispatchFn,
    zWebhookSubscribeFn,
    zWebhookVerify,
} from "../hooks/webhooks.ts";

/**
 * WEBHOOK SECTIONS (design D36) — the def-side declarations. Two scopes,
 * mirroring the v1 binding model's two path shapes:
 *   - ACCOUNT scope (provider def `webhooks.account`): one vendor-account
 *     stream fanning into per-workspace meaning via `correlate`
 *     (`/v1/providers/:provider/account/{slug}`).
 *   - RESOURCE scope (resource def `webhooks`): per-resource
 *     registrations (`/v1/providers/:provider/resource/{resourceId}/
 *     {slug}`), where `subscribe` is REQUIRED — a per-resource stream
 *     without upstream registration cannot exist.
 * The HOST owns the ingress route, raw-byte signature verification (the
 * declarative `verify` descriptor), the routing rows, and executing
 * dispatch actions; docs own the vocabulary.
 */

export const zWebhookSlug = z.string().regex(
    /^[a-z0-9][a-z0-9-]*$/,
    "webhook slug must be lowercase kebab-case",
);
export type WebhookSlug = z.infer<typeof zWebhookSlug>;

/** One account-scope hook. No `subscribe` = MANUAL registration: the host
 *  boot-reconcile ensures the routing row and LOGS the callback URL for
 *  the operator to paste into the vendor dashboard (saperly). */
export const zAccountWebhook = z.strictObject({
    verify: zWebhookVerify,
    correlate: zWebhookCorrelateFn,
    dispatch: zWebhookDispatchFn,
    subscribe: zWebhookSubscribeFn.optional(),
    unsubscribe: zWebhookSubscribeFn.optional(),
});
export type AccountWebhook = z.infer<typeof zAccountWebhook>;

export const zWebhooksSection = z.strictObject({
    account: z.record(zWebhookSlug, zAccountWebhook),
});
export type WebhooksSection = z.infer<typeof zWebhooksSection>;

/** One resource-scope hook — `subscribe` REQUIRED (idempotent: keys
 *  derive from resource identity + a URL hash, re-asserts converge). */
export const zResourceWebhook = z.strictObject({
    verify: zWebhookVerify,
    correlate: zWebhookCorrelateFn,
    dispatch: zWebhookDispatchFn,
    subscribe: zResourceWebhookSubscribeFn,
    unsubscribe: zResourceWebhookSubscribeFn.optional(),
});
export type ResourceWebhook = z.infer<typeof zResourceWebhook>;

export const zResourceWebhooksSection = z.record(
    zWebhookSlug,
    zResourceWebhook,
);
export type ResourceWebhooksSection = z.infer<
    typeof zResourceWebhooksSection
>;
