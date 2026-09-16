import { z } from "zod";
import { zJson } from "../json/type.ts";
import { zRunInput } from "../run/input.ts";
import { zEndpointId } from "../common/ids.ts";
import { fnCarrier, type FnUtils, type HookLogger } from "./ctx.ts";
import type { LifecycleHttpFn } from "./lifecycle.ts";
import { zResourceRow, zResourceTarget } from "../resource/row.ts";

/**
 * WEBHOOK HOOKS (design D36) — declared on docs, EXECUTED BY THE HOST
 * ingress (the engine never listens). The v1 binding model is the contract:
 * one route `POST /v1/providers/:provider/*`, the path remainder IS the
 * binding (`account/{slug}` | `resource/{resourceId}/{slug}`), the only
 * stored state a routing row, and verification a signature over the EXACT
 * raw bytes (paths are guessable by design).
 *
 *   - `verify`: DECLARATIVE (an HMAC descriptor — no crypto in fns; the
 *     host executes it).
 *   - `correlate`: PURE — WHO the delivery belongs to.
 *   - `dispatch`: PURE — WHAT to do (a closed action vocabulary).
 *   - `subscribe`/`unsubscribe`: EFFECTFUL upstream registration, for
 *     vendors WITH a registration API. An account hook without `subscribe`
 *     is MANUAL: the host boot-reconcile ensures the routing row and LOGS
 *     the callback URL to paste in the vendor dashboard (saperly).
 */

// ---------------------------------------------------------------------------
// verify — declarative descriptor
// ---------------------------------------------------------------------------

export const zWebhookVerify = z.strictObject({
    scheme: z.literal("hmac-sha256"),
    signatureHeader: z.string().min(1),
    timestampHeader: z.string().min(1),
    /** The signed payload template — the one supported spelling today. */
    payload: z.literal("${timestamp}.${rawBody}"),
    toleranceMs: z.number().int().positive(),
});
export type WebhookVerify = z.infer<typeof zWebhookVerify>;

// ---------------------------------------------------------------------------
// correlate — WHO
// ---------------------------------------------------------------------------

/** One verified delivery as fns see it: lower-cased headers + the
 *  sniff-decoded body. */
export const zWebhookDelivery = z.strictObject({
    headers: z.record(z.string(), z.string()),
    body: zJson,
});
export type WebhookDelivery = z.infer<typeof zWebhookDelivery>;

export const zWebhookCorrelateData = z.strictObject({
    delivery: zWebhookDelivery,
});
export type WebhookCorrelateData = z.infer<typeof zWebhookCorrelateData>;

/**
 * Correlation kinds → host resolution:
 *   - `resource`: the workspace OWNING that resource (ownership pointer).
 *   - `alias`: an E.164 alias pointer (an inbound callee is known only by
 *     number — saperly `call.received`).
 *   - `run`: an in-flight run — `externalRunId` must be the run's own
 *     lifecycle join key VERBATIM (state.externalRunId).
 *   - `unhandled`: expected traffic the provider does not map — dropped
 *     with the event name, never an error.
 */
export const zWebhookCorrelation = z.discriminatedUnion("kind", [
    z.strictObject({
        kind: z.literal("resource"),
        target: zResourceTarget,
    }),
    z.strictObject({ kind: z.literal("alias"), e164: z.string().min(1) }),
    z.strictObject({
        kind: z.literal("run"),
        externalRunId: z.string().min(1),
    }),
    z.strictObject({ kind: z.literal("unhandled"), event: z.string() }),
]);
export type WebhookCorrelation = z.infer<typeof zWebhookCorrelation>;

export type WebhookCorrelateFn = (
    ctx: {
        data: WebhookCorrelateData;
        utils: FnUtils;
        logger: HookLogger;
    },
) => WebhookCorrelation;
export const zWebhookCorrelateFn = fnCarrier<WebhookCorrelateFn>(
    "a webhooks correlate fn",
);

// ---------------------------------------------------------------------------
// dispatch — WHAT (the closed v1 action vocabulary)
// ---------------------------------------------------------------------------

/**
 *   - `run`: START A RUN of `endpoint` in the correlated workspace — the
 *     resource-starts-a-run path (a call arrives on YOUR number ⇒
 *     inbound-calls starts there, adopts the external id, bills like any
 *     run). `runKey` makes duplicate deliveries converge on ONE
 *     deterministic run (default: the delivery id). Control policy:
 *     `bill-only` = already-received work is billed, never refused;
 *     `admit-overdraft` = admit always, the accrual loop enforces.
 *   - `signal-run`: nudge the correlated in-flight run's poll — `runKey`
 *     must reproduce the run's externalRunId VERBATIM.
 *   - `refresh`: run the resource doc's refresh op on `target`.
 *   - `ignore`: intentionally unmapped events — stated policy, not an
 *     error.
 */
export const zWebhookAction = z.discriminatedUnion("action", [
    z.strictObject({
        action: z.literal("run"),
        endpoint: zEndpointId,
        input: zRunInput,
        runKey: z.string().min(1).optional(),
        controlPolicy: z.enum(["bill-only", "admit-overdraft"]).optional(),
    }),
    z.strictObject({
        action: z.literal("signal-run"),
        runKey: z.string().min(1),
    }),
    z.strictObject({
        action: z.literal("refresh"),
        target: zResourceTarget,
    }),
    z.strictObject({ action: z.literal("ignore") }),
]);
export type WebhookAction = z.infer<typeof zWebhookAction>;

export type WebhookDispatchFn = (
    ctx: {
        data: WebhookCorrelateData;
        utils: FnUtils;
        logger: HookLogger;
    },
) => WebhookAction;
export const zWebhookDispatchFn = fnCarrier<WebhookDispatchFn>(
    "a webhooks dispatch fn",
);

// ---------------------------------------------------------------------------
// subscribe / unsubscribe — effectful upstream registration
// ---------------------------------------------------------------------------

export interface WebhookSubscribeUtils extends FnUtils {
    http: LifecycleHttpFn;
}

/** Account scope: the callback URL is the whole context. */
export const zWebhookSubscribeData = z.strictObject({
    callbackUrl: z.url(),
});
export type WebhookSubscribeData = z.infer<typeof zWebhookSubscribeData>;

export type WebhookSubscribeFn = (
    ctx: {
        data: WebhookSubscribeData;
        utils: WebhookSubscribeUtils;
        logger: HookLogger;
    },
) => Promise<void>;
export const zWebhookSubscribeFn = fnCarrier<WebhookSubscribeFn>(
    "a webhooks subscribe fn",
);

/** Resource scope: + the target and its stored row (per-resource
 *  registration; idempotency keys derive from resource identity + a URL
 *  hash so re-asserts converge). */
export const zResourceWebhookSubscribeData = z.strictObject({
    callbackUrl: z.url(),
    target: zResourceTarget,
    row: zResourceRow,
});
export type ResourceWebhookSubscribeData = z.infer<
    typeof zResourceWebhookSubscribeData
>;

export type ResourceWebhookSubscribeFn = (
    ctx: {
        data: ResourceWebhookSubscribeData;
        utils: WebhookSubscribeUtils;
        logger: HookLogger;
    },
) => Promise<void>;
export const zResourceWebhookSubscribeFn = fnCarrier<
    ResourceWebhookSubscribeFn
>("a resource webhooks subscribe fn");
