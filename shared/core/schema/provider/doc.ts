import { z } from "zod";
import { contractConfig } from "../../config.ts";
import { zDocHash, zProviderName, zSemverString } from "../common/ids.ts";
import { zProviderMeta } from "../meta/provider.ts";
import { zFnRef } from "../fn-table/ref.ts";
import { zWebhookSlug } from "../sections/webhooks.ts";
import { zWebhookVerify } from "../hooks/webhooks.ts";

/** One compiled account-scope webhook: the declarative verify descriptor
 *  verbatim, fn slots as $fn refs. Executed by the HOST ingress via the
 *  provider sealed unit. */
export const zAccountWebhookDoc = z.strictObject({
    verify: zWebhookVerify,
    correlate: zFnRef,
    dispatch: zFnRef,
    subscribe: zFnRef.optional(),
    unsubscribe: zFnRef.optional(),
});
export type AccountWebhookDoc = z.infer<typeof zAccountWebhookDoc>;

/**
 * zProviderDoc — the provider's identity + display info, and NOTHING
 * derivable:
 *   - no endpoint index (select on `endpointDoc.provider` — the bundle's
 *     endpoints map makes that trivial; an embedded index could silently
 *     drift);
 *   - no credentials copy (every EndpointDoc carries the fused
 *     `auth.credentials`; a provider-level copy goes stale the moment an
 *     endpoint overrides).
 * Provider meta is never copied into endpoints (only the docsUrl/categories
 * leaves fall back at compile).
 */
export const zProviderDoc = z.strictObject({
    specVersion: z.literal(contractConfig.schema.specVersion),
    name: zProviderName,
    /** Max over this provider's endpoints. */
    minEngineVersion: zSemverString,
    meta: zProviderMeta,
    /** Account-scope webhooks (design D36) — the one fn-bearing provider
     *  doc section: the host ingress executes these through the provider
     *  sealed unit ({providerDoc, fns}). */
    webhooks: z.strictObject({
        account: z.record(zWebhookSlug, zAccountWebhookDoc),
    }).optional(),
    hash: zDocHash,
});
export type ProviderDoc = z.infer<typeof zProviderDoc>;

/** Collect every $fn id a provider doc references. */
export function providerFnKeysOf(doc: ProviderDoc): string[] {
    const keys: string[] = [];
    for (const hook of Object.values(doc.webhooks?.account ?? {})) {
        keys.push(hook.correlate.$fn.key, hook.dispatch.$fn.key);
        if (hook.subscribe) keys.push(hook.subscribe.$fn.key);
        if (hook.unsubscribe) keys.push(hook.unsubscribe.$fn.key);
    }
    return [...new Set(keys)];
}
