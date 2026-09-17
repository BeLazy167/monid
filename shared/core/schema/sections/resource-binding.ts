import { z } from "zod";
import { zResourceId } from "../resource/ids.ts";
import { zEnsureFn, zProvisionSeedFn } from "../hooks/resource-binding.ts";

/**
 * ENDPOINT↔RESOURCE BINDING (design D32) — ONE optional `resource:` block
 * on the endpoint def, replacing v1's per-def verb soup
 * (createsResources / usesResource / releasesResource / refreshesResource
 * / consumesOwnResources / ensureResources) with one derived judgment:
 * the INTERACTION names the relationship; everything the host needs
 * (ownership pre-gate, provision persistence, release/refresh/reconcile
 * marks, reader capability) derives from it. ENDPOINT-ONLY — a provider
 * cannot default a binding (which endpoints touch resources is the least
 * provider-uniform fact there is).
 */

/**
 *   - CREATES:  a success PROVISIONS — `seed` (required here) maps the
 *     settled envelope to the persisted record(s).
 *   - USES:     the run consumes an owned resource (places a call FROM
 *     your number): ownership-gated via `key`; marks the resource for
 *     variable-cost reconcile at settle.
 *   - UPDATES:  mutates upstream resource state (connect/disconnect):
 *     ownership-gated; marks it for refresh at settle.
 *   - RELEASES: tears down: ownership-gated; a success marks the row
 *     released (billing stops host-side).
 *   - READS:    read-only against an owned resource: ownership-gated,
 *     no settle marks.
 */
export const ResourceInteraction = {
    CREATES: "CREATES",
    USES: "USES",
    UPDATES: "UPDATES",
    RELEASES: "RELEASES",
    READS: "READS",
} as const;
export type ResourceInteraction =
    (typeof ResourceInteraction)[keyof typeof ResourceInteraction];

export const zResourceInteraction = z.enum(ResourceInteraction);

export const zResourceBindingSection = z.strictObject({
    /** The bound resource doc — "<provider>/<name>"; same-provider
     *  (compile-checked against the connector's own resources). */
    id: zResourceId,
    interaction: zResourceInteraction,
    /** JSONPath into the VALIDATED input naming the externalId the run
     *  targets (e.g. `$.body.from`) — REQUIRED for UPDATES/RELEASES
     *  (their settle marks need a target), OPTIONAL for USES/READS (an
     *  ANCHOR endpoint derives ownership in-fn via `utils.resources` —
     *  saperly's call artifacts; a pure reader serves from the reader
     *  alone — list-numbers), FORBIDDEN for CREATES (nothing exists yet
     *  to target). When present the engine resolves it and pre-gates:
     *  not owned ⇒ the uniform vendor-shaped 404 AS DATA, zero usage,
     *  upstream never touched. */
    key: z.string().min(1).optional(),
    /** CREATES-only (required there, forbidden elsewhere). */
    seed: zProvisionSeedFn.optional(),
    /** Gated interactions only: pre-run prerequisites (v1
     *  ensureResources). FORBIDDEN on CREATES — the run itself IS the
     *  provisioner there; a prerequisite that provisions belongs on the
     *  endpoints that USE the resource. */
    ensure: zEnsureFn.optional(),
}).superRefine((binding, ctx) => {
    if (binding.interaction === ResourceInteraction.CREATES) {
        if (binding.seed === undefined) {
            ctx.addIssue({
                code: "custom",
                path: ["seed"],
                message: "CREATES binding requires seed",
            });
        }
        if (binding.key !== undefined) {
            ctx.addIssue({
                code: "custom",
                path: ["key"],
                message: "CREATES binding cannot take key (nothing to target)",
            });
        }
        if (binding.ensure !== undefined) {
            ctx.addIssue({
                code: "custom",
                path: ["ensure"],
                message:
                    "ensure is forbidden on CREATES — the run itself provisions",
            });
        }
    } else {
        if (
            binding.key === undefined &&
            (binding.interaction === ResourceInteraction.UPDATES ||
                binding.interaction === ResourceInteraction.RELEASES)
        ) {
            ctx.addIssue({
                code: "custom",
                path: ["key"],
                message:
                    `${binding.interaction} binding requires key (its settle mark needs a target)`,
            });
        }
        if (binding.seed !== undefined) {
            ctx.addIssue({
                code: "custom",
                path: ["seed"],
                message: "seed is CREATES-only",
            });
        }
    }
});
export type ResourceBindingSection = z.infer<typeof zResourceBindingSection>;
