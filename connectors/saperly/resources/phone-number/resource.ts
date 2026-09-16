import { z } from "zod";
import { defineResource } from "@shared/core";
import {
    zConnectionPatchInput,
    zCountry,
    zNumberId,
    zProvisionConnectionInput,
} from "../../schema/common.ts";

/**
 * saperly/phone-number — a rented US phone number with its AI persona,
 * ported from monid-services `adaptors/saperly/resources/phone-number.ts`
 * (the v1 renewable `phone_number` resource; id inferred from this
 * folder).
 *
 * BILLING (design D31, the v1 policy verbatim): $2/MONTH prepaid rent,
 * CREATION-anchored. Period 1 is charged by the CREATING run
 * (/provision-numbers' own $2 PER_CALL model); renewals charge from 3
 * days before each period end (chargeLeadMs), and an unpaid/released
 * number tears down 6 h BEFORE the period end (releaseLeadMs) so the
 * vendor never bills a cycle the user didn't pay (the v1 over-charge
 * fix). Sticky max-rule: the host charges max($2 card, the provision
 * seed's quoted rentConsumes). No `variable` — a phone number has no
 * dynamic cost stream.
 *
 * CONNECTION POINTER POLICY (v1 refresh doc, carried verbatim):
 * `externalRefs.connection` is AUTHORITATIVE from upstream — a refresh
 * that reads no connectionId CLEARS the stored pointer (a stale internal
 * id must never survive); phoneNumber/country/numberType carry forward on
 * degraded reads (a live number's E.164 does not vanish).
 */
export default defineResource({
    meta: {
        displayName: "Phone Number",
        summary: "A rented US phone number with its AI persona.",
        description:
            "A real US phone number (local or toll-free) owned by this " +
            "workspace, with an AI persona (Saperly connection) answering " +
            "and placing its calls. Rents at $2/month prepaid; release " +
            "any time — the number stays usable until its paid-through " +
            "date.",
        docsUrl: "https://saperly.com/docs/guides/numbers",
    },
    data: z.strictObject({
        /** E.164 — may lag a degraded provision read; refresh converges. */
        phoneNumber: z.string().optional(),
        country: z.string(),
        numberType: z.enum(["local", "toll_free"]),
        /** ONLY the pointer persists — persona CONTENT is read live via
         *  the `connection` external (it can never go stale). */
        externalRefs: z.strictObject({
            connection: z.string().min(1),
        }).optional(),
    }),
    /** CATALOG-ONLY shapes of the user actions; the EXECUTABLE contracts
     *  live on the bound endpoints (compile-checked supersets). */
    inputs: {
        create: z.object({
            country: zCountry,
            connection: zProvisionConnectionInput,
        }),
        /** `connection` optional HERE (catalog shape): TWO endpoints bind
         *  UPDATES — /update-numbers (the persona edit, which requires a
         *  connection patch on its OWN contract) and /sync-numbers (the
         *  webhook-driven re-sync, which takes only the id). The slot is
         *  their common surface; each endpoint's input stays stricter. */
        update: z.object({
            numberId: zNumberId,
            connection: zConnectionPatchInput.optional(),
        }),
        release: z.object({ numberId: zNumberId }),
    },
    billing: {
        period: { unit: "MONTH", count: 1, anchor: "CREATION" },
        rent: {
            consumes: { credit: "default", amount: 2 },
            chargeLeadMs: 3 * 24 * 3_600_000,
            releaseLeadMs: 6 * 3_600_000,
        },
    },
    ops: {
        /**
         * check (v1 verify): `GET /numbers/{id}` aliveness before every
         * charge. 404 / releasedAt ⇒ inactive (attributable reason — an
         * inactive verdict triggers an irreversible release); other
         * non-2xx THROWS (retriable — the charge attempt retries; never
         * conclude from a flaky read). Returns the vendor's current
         * monthly price (the host's drift/max-rule channel) and its own
         * period end (reconciliation signal only).
         */
        check: async ({ data, utils }) => {
            const $ = utils.json;
            const res = await utils.http({
                method: "GET",
                path: "/numbers/" + data.target.externalId,
            });
            if (res.status === 404) {
                return { active: false, inactiveReason: "http_404" };
            }
            if (res.status < 200 || res.status >= 300) {
                throw new Error(
                    "saperly number check failed with HTTP " + res.status,
                );
            }
            const releasedAt = $.optionalStr(res.body, "$.releasedAt");
            if (releasedAt !== undefined) {
                return {
                    active: false,
                    inactiveReason: "released_at:" + releasedAt,
                };
            }
            const cents = $.optionalNum(res.body, "$.monthlyPriceCents");
            const periodEnd = $.optionalStr(res.body, "$.nextChargeAt");
            return {
                active: true,
                ...(periodEnd !== undefined ? { periodEndIso: periodEnd } : {}),
                ...(cents !== undefined
                    ? {
                        observed: {
                            consumes: {
                                credit: "default",
                                amount: cents / 100,
                            },
                        },
                    }
                    : {}),
            };
        },
        /**
         * release (v1): `POST /numbers/{id}/release`, idempotent —
         * 404/410 tolerated as success, stable per-resource
         * Idempotency-Key so retries converge. The number's EMBEDDED
         * connection dies with it: a failed connection delete THROWS
         * (retriable) so the activity re-runs instead of faking RELEASED
         * over an orphaned persona.
         */
        release: async ({ data, utils }) => {
            const gone = (status: number) => status === 404 || status === 410;
            const rel = await utils.http({
                method: "POST",
                path: "/numbers/" + data.target.externalId + "/release",
                headers: {
                    "Idempotency-Key": data.target.externalId + ":release",
                },
                body: {},
            });
            if (!(rel.status >= 200 && rel.status < 300) && !gone(rel.status)) {
                throw new Error(
                    "saperly number release failed with HTTP " + rel.status,
                );
            }
            const connection = data.row.data.externalRefs?.connection;
            if (connection !== undefined) {
                const del = await utils.http({
                    method: "DELETE",
                    path: "/connections/" + connection,
                    headers: {
                        "Idempotency-Key": connection + ":release",
                    },
                });
                if (
                    !(del.status >= 200 && del.status < 300) &&
                    !gone(del.status)
                ) {
                    throw new Error(
                        "saperly connection delete failed with HTTP " +
                            del.status + " on number release",
                    );
                }
            }
            return { released: true };
        },
        /**
         * refresh (v1): re-read the number and return the FULL type-field
         * patch. phoneNumber/country/numberType carry forward on degraded
         * reads; the connection POINTER is AUTHORITATIVE — absence
         * upstream CLEARS it. 404 ⇒ inactive (no patch); other non-2xx
         * THROWS (never silently blank the copy).
         */
        refresh: async ({ data, utils }) => {
            const $ = utils.json;
            const res = await utils.http({
                method: "GET",
                path: "/numbers/" + data.target.externalId,
            });
            if (res.status === 404) return { active: false };
            if (res.status < 200 || res.status >= 300) {
                throw new Error(
                    "saperly number refresh failed with HTTP " + res.status,
                );
            }
            const connection = $.optionalStr(res.body, "$.connectionId");
            const phoneNumber = $.optionalStr(res.body, "$.phoneNumber") ??
                data.row.data.phoneNumber;
            const numberType = $.optionalStr(res.body, "$.numberType");
            return {
                active: true,
                patch: {
                    country: $.optionalStr(res.body, "$.country") ??
                        data.row.data.country,
                    numberType:
                        numberType === "toll_free" || numberType === "local"
                            ? numberType
                            : data.row.data.numberType,
                    ...(phoneNumber !== undefined ? { phoneNumber } : {}),
                    // absence upstream CLEARS the pointer (authoritative)
                    ...(connection !== undefined
                        ? { externalRefs: { connection } }
                        : {}),
                },
            };
        },
    },
    externals: {
        /**
         * The number's LIVE persona (v1 externalKinds.connection.inspect)
         * — fetched fresh on every read, SANITIZED through the allowlist
         * (never `id`/`manualSecret`/`mcpServers`). `display: true`: this
         * is the host-exposed detail surface.
         */
        connection: {
            display: true,
            read: async ({ data, utils }) => {
                const $ = utils.json;
                const ref = data.row.data.externalRefs?.connection;
                if (ref === undefined) return { connection: null };
                const res = await utils.http({
                    method: "GET",
                    path: "/connections/" + ref,
                });
                if (res.status < 200 || res.status >= 300) {
                    throw new Error(
                        "saperly connection read failed with HTTP " +
                            res.status,
                    );
                }
                return {
                    connection: $.pick(res.body, [
                        "$.name",
                        "$.mode",
                        "$.instructions",
                        "$.language",
                        "$.tts",
                        "$.llm",
                        "$.callControl",
                        "$.complianceEnabled",
                        "$.disclosure",
                        "$.smsAutoReply",
                        "$.recordingEnabled",
                    ]),
                };
            },
        },
    },
});
