import { z } from "zod";
import { zBaseMeta } from "../meta/base.ts";
import { zSchemaCarrier } from "../hooks/ctx.ts";
import { zResourceWebhooksSection } from "../sections/webhooks.ts";
import { zResourceBilling } from "./billing.ts";
import {
    zResourceCheckFn,
    zResourceExternal,
    zResourceRefreshFn,
    zResourceReleaseFn,
} from "./ops.ts";

/**
 * zResourceDef — a RESOURCE as a first-class sibling of the endpoint def
 * (design D30): the durable, billable thing a provider can OWN on a
 * workspace's behalf (a phone number, a mailbox, a VM). Lives at
 * `connectors/<provider>/resources/<name>/resource.ts`; its id
 * `<provider>/<name>` is folder-inferred, never authored.
 *
 * The def declares WHAT the resource is (data shape), what the PLATFORM
 * may do to it unprompted (ops — no user input by construction: an op fn
 * ctx simply has no input field), how money flows while it exists
 * (billing), its always-live reads (externals) and its event streams
 * (webhooks). What USERS do to it is not here — user actions are ordinary
 * ENDPOINTS, bound via the endpoint's `resource:` block.
 *
 * No auth/request/timeouts sections: resources always run under their
 * provider's fused identity (compiler copies the provider's resolved
 * auth + origin + requestMs into the doc).
 */
export const zResourceDef = z.strictObject({
    meta: zBaseMeta,
    /** The stored-row shape — what the host persists per owned instance
     *  and serves back into every op/endpoint read (compiled to JSON
     *  Schema; live truth stays upstream, this is the snapshot). */
    data: zSchemaCarrier,
    /** DISPLAY/CATALOG-ONLY input shapes of the user actions (create /
     *  update / release) — the acquisition surface a catalog can render
     *  without walking endpoints. The EXECUTABLE contracts stay on the
     *  bound endpoints; the compiler checks each bound endpoint's input
     *  is a SUPERSET of the matching slot here. */
    inputs: z.strictObject({
        create: zSchemaCarrier.optional(),
        update: zSchemaCarrier.optional(),
        release: zSchemaCarrier.optional(),
    }).optional(),
    /** Absent = a free resource (no schedule at all). */
    billing: zResourceBilling.optional(),
    ops: z.strictObject({
        check: zResourceCheckFn,
        release: zResourceReleaseFn,
        refresh: zResourceRefreshFn.optional(),
    }),
    externals: z.record(
        z.string().regex(
            /^[a-z0-9][a-z0-9-]*$/,
            "external kind must be lowercase kebab-case",
        ),
        zResourceExternal,
    ).optional(),
    webhooks: zResourceWebhooksSection.optional(),
});

export type ResourceDefSeed = z.input<typeof zResourceDef>;
export type ResourceDef = z.output<typeof zResourceDef>;
