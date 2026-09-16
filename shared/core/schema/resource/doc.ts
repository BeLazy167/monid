import { z } from "zod";
import { contractConfig } from "../../config.ts";
import { zDocHash, zProviderName, zSemverString } from "../common/ids.ts";
import { zBaseMeta } from "../meta/base.ts";
import { zJsonSchemaDoc } from "../endpoint/json-schema-doc.ts";
import { zFnRef } from "../fn-table/ref.ts";
import { zWebhookSlug } from "../sections/webhooks.ts";
import { zWebhookVerify } from "../hooks/webhooks.ts";
import { zResourceId } from "./ids.ts";
import { zBillingPeriod, zRent } from "./billing.ts";
import { zConsumes } from "../usage/model/consumes.ts";
import { zUnit } from "../usage/unit.ts";

/**
 * zResourceDoc — the COMPILED resource artifact (design D30): pure, flat,
 * strict JSON beside the endpoint docs in the bundle. Fn-bearing slots
 * hold `$fn` refs; auth + origin + timeout are FUSED from the provider at
 * compile (a resource doc executes as its own sealed unit, no provider
 * lookup at run time — the endpoint-doc rule).
 */

export const zVariableBillingDoc = z.strictObject({
    price: z.strictObject({
        unit: zUnit,
        every: z.number().int().positive(),
        consumes: zConsumes,
    }),
    holdCadenceMs: z.number().int().positive(),
    buffer: zConsumes,
    getActualCost: zFnRef,
});
export type VariableBillingDoc = z.infer<typeof zVariableBillingDoc>;

export const zResourceBillingDoc = z.strictObject({
    period: zBillingPeriod,
    rent: zRent.optional(),
    variable: zVariableBillingDoc.optional(),
});
export type ResourceBillingDoc = z.infer<typeof zResourceBillingDoc>;

export const zResourceWebhookDoc = z.strictObject({
    verify: zWebhookVerify,
    correlate: zFnRef,
    dispatch: zFnRef,
    subscribe: zFnRef,
    unsubscribe: zFnRef.optional(),
});
export type ResourceWebhookDoc = z.infer<typeof zResourceWebhookDoc>;

export const zResourceDoc = z.strictObject({
    specVersion: z.literal(contractConfig.schema.specVersion),
    /** "<provider>/<name>" — folder-derived, never authored. */
    id: zResourceId,
    provider: zProviderName,
    /** Compiler-derived: semverMax(resources_since, api of every $fn). */
    minEngineVersion: zSemverString,
    meta: zBaseMeta,
    data: z.strictObject({ schema: zJsonSchemaDoc }),
    inputs: z.strictObject({
        create: zJsonSchemaDoc.optional(),
        update: zJsonSchemaDoc.optional(),
        release: zJsonSchemaDoc.optional(),
    }).optional(),
    billing: zResourceBillingDoc.optional(),
    ops: z.strictObject({
        check: zFnRef,
        release: zFnRef,
        refresh: zFnRef.optional(),
    }),
    externals: z.record(
        z.string().min(1),
        z.strictObject({ read: zFnRef, display: z.boolean() }),
    ).optional(),
    webhooks: z.record(zWebhookSlug, zResourceWebhookDoc).optional(),
    /** Fused from the provider (same injector + credential shape as the
     *  provider's endpoints). */
    auth: z.strictObject({
        inject: zFnRef,
        credentials: zJsonSchemaDoc,
    }),
    /** The provider ORIGIN ops resolve `path` against (no method — a
     *  resource has no one compiled request). */
    request: z.strictObject({ url: z.string().min(1) }),
    timeouts: z.strictObject({
        requestMs: z.number().int().positive(),
    }),
    hash: zDocHash,
});
export type ResourceDoc = z.infer<typeof zResourceDoc>;

/** Collect every $fn id a resource doc references. */
export function resourceFnKeysOf(doc: ResourceDoc): string[] {
    const keys: string[] = [doc.auth.inject.$fn.key];
    keys.push(doc.ops.check.$fn.key, doc.ops.release.$fn.key);
    if (doc.ops.refresh) keys.push(doc.ops.refresh.$fn.key);
    if (doc.billing?.variable) {
        keys.push(doc.billing.variable.getActualCost.$fn.key);
    }
    for (const external of Object.values(doc.externals ?? {})) {
        keys.push(external.read.$fn.key);
    }
    for (const hook of Object.values(doc.webhooks ?? {})) {
        keys.push(hook.correlate.$fn.key, hook.dispatch.$fn.key);
        keys.push(hook.subscribe.$fn.key);
        if (hook.unsubscribe) keys.push(hook.unsubscribe.$fn.key);
    }
    return [...new Set(keys)];
}
