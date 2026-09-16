import { z } from "zod";
import { type Json, zJson } from "../json/type.ts";
import { fnCarrier, type FnUtils, type HookLogger } from "../hooks/ctx.ts";
import type { LifecycleHttpFn, LifecycleSleepFn } from "../hooks/lifecycle.ts";
import { zResourceRow, zResourceTarget } from "./row.ts";
export {
    type ResourceQuery,
    type ResourceRow,
    type ResourceTarget,
    zResourceQuery,
    zResourceRow,
    zResourceTarget,
} from "./row.ts";

/**
 * RESOURCE OPS — the platform-driven, no-user-input operations of a
 * resource def (design D30; ↔ v1 resourceDef verify/release/refresh +
 * externalKinds). Ops are EFFECTFUL fns with the same posture as the
 * endpoint lifecycle family: `utils.http` through the ONE transport port
 * (same-origin credential rule), throw = retriable (the host activity
 * retries — RESOURCE_OP_FAILED), `retriable === false` throw = FN_CONTRACT
 * (deterministic fn bug), outcomes zod-validated after the awaited return.
 *
 * The HOST workflow owns when/whether (schedules, holds, events,
 * exactly-once); the doc owns how (the upstream HTTP anatomy).
 */

/**
 * `utils` for resource-op fns: the pure ABI + `http` (raw calls against
 * the provider origin) + `sleep` (bounded in-phase waits) + `external`
 * (run the doc's OWN compiled external reader — ONE reader for the bill
 * AND the preview, by construction; design D33).
 */
export type ResourceExternalCall = (
    kind: string,
    args?: Json,
) => Promise<Json>;

export interface ResourceOpUtils extends FnUtils {
    http: LifecycleHttpFn;
    sleep: LifecycleSleepFn;
    external: ResourceExternalCall;
}

// ---------------------------------------------------------------------------
// ctx.data + outcomes
// ---------------------------------------------------------------------------

/** ctx.data shared by check / release / refresh — the target + the stored
 *  row. */
export const zResourceOpData = z.strictObject({
    target: zResourceTarget,
    row: zResourceRow,
});
export type ResourceOpData = z.infer<typeof zResourceOpData>;

/**
 * check — periodic aliveness (v1 `verify`): the host calls it before EVERY
 * rent charge ("never charge a dead resource") and on demand.
 * ↔ v1 ResourceVerification {active, inactiveReason?, cost?,
 * providerPeriodEnd?}.
 */
export const zCheckOutcome = z.strictObject({
    active: z.boolean(),
    inactiveReason: z.string().min(1).optional(),
    /** The vendor's own period end, when readable (reconciliation/drift
     *  signal — ↔ v1 providerPeriodEnd). */
    periodEndIso: z.iso.datetime().optional(),
    /** Vendor-observed CURRENT rent, when readable (↔ v1 verify.cost) —
     *  the host's drift/max-rule channel; never changes the sticky
     *  charge by itself. */
    observed: z.strictObject({
        consumes: z.strictObject({
            credit: z.string().min(1),
            amount: z.number().nonnegative(),
        }).optional(),
    }).optional(),
});
export type CheckOutcome = z.infer<typeof zCheckOutcome>;

/**
 * release — idempotent upstream teardown (v1 `release`: 404/410 tolerated
 * as success; stable idempotency keys so retries converge). MAY return the
 * vendor's settled final bill (`settled` — the smolmachine
 * teardown-as-invoice mechanism).
 */
export const zReleaseOutcome = z.strictObject({
    released: z.literal(true),
    settled: z.strictObject({
        consumes: z.strictObject({
            credit: z.string().min(1),
            amount: z.number().nonnegative(),
        }),
    }).optional(),
});
export type ReleaseOutcome = z.infer<typeof zReleaseOutcome>;

/**
 * refresh — re-sync the stored snapshot from upstream (v1 `refresh`):
 * `patch` is the FULL type-field override (the def decides its own
 * carry-forward policy for degraded reads — e.g. saperly's connection
 * pointer is AUTHORITATIVE: absence clears it). The engine validates the
 * patch against the doc's dataSchema.
 */
export const zRefreshOutcome = z.strictObject({
    active: z.boolean(),
    patch: zJson.optional(),
});
export type RefreshOutcome = z.infer<typeof zRefreshOutcome>;

export type ResourceCheckFn = (
    ctx: { data: ResourceOpData; utils: ResourceOpUtils; logger: HookLogger },
) => Promise<CheckOutcome>;
export const zResourceCheckFn = fnCarrier<ResourceCheckFn>(
    "an ops.check fn",
);

export type ResourceReleaseFn = (
    ctx: { data: ResourceOpData; utils: ResourceOpUtils; logger: HookLogger },
) => Promise<ReleaseOutcome>;
export const zResourceReleaseFn = fnCarrier<ResourceReleaseFn>(
    "an ops.release fn",
);

export type ResourceRefreshFn = (
    ctx: { data: ResourceOpData; utils: ResourceOpUtils; logger: HookLogger },
) => Promise<RefreshOutcome>;
export const zResourceRefreshFn = fnCarrier<ResourceRefreshFn>(
    "an ops.refresh fn",
);

// ---------------------------------------------------------------------------
// externals — named always-live reads (design D33; ↔ v1 externalKinds)
// ---------------------------------------------------------------------------

/** ctx.data for an external read: the target + row + optional caller args
 *  (e.g. a window when the billing meter delegates here). */
export const zResourceExternalData = z.strictObject({
    target: zResourceTarget,
    row: zResourceRow,
    args: zJson.optional(),
});
export type ResourceExternalData = z.infer<typeof zResourceExternalData>;

export type ResourceExternalFn = (
    ctx: {
        data: ResourceExternalData;
        utils: ResourceOpUtils;
        logger: HookLogger;
    },
) => Promise<Json>;
export const zResourceExternalFn = fnCarrier<ResourceExternalFn>(
    "an externals read fn",
);

/** One named always-live read. `display: true` kinds are the host-exposed
 *  detail surface; `display: false` kinds are internal-only (billing /
 *  endpoint use — not all live data needs showing). Never persisted. */
export const zResourceExternal = z.strictObject({
    read: zResourceExternalFn,
    display: z.boolean().default(false),
});
export type ResourceExternal = z.infer<typeof zResourceExternal>;
