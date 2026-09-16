import { z } from "zod";
import { zJson } from "../json/type.ts";
import { zResourceId } from "./ids.ts";

/**
 * Resource ADDRESSING + the stored ROW — dependency-leaf shapes (no hook
 * imports) shared by resource ops, lifecycle utils (`utils.resources`) and
 * webhook hooks.
 */

/** One owned resource, addressed by its doc id + the vendor's own id. */
export const zResourceTarget = z.strictObject({
    /** Resource doc id — "<provider>/<name>", SELF-DESCRIBING (a
     *  cross-provider ensure seed resolves its doc on the seed's own
     *  provider). */
    resource: zResourceId,
    /** The vendor's identifier (v1 externalId — the ownership-pointer
     *  key). */
    externalId: z.string().min(1),
});
export type ResourceTarget = z.infer<typeof zResourceTarget>;

/** A stored resource ROW as the host serves it back — the snapshot the
 *  def's `data` schema describes, plus identity. Host-owned fields
 *  (workspace, billing schedule, events) never appear: the engine and the
 *  fns see exactly what the doc declared. */
export const zResourceRow = z.strictObject({
    resource: zResourceId,
    externalId: z.string().min(1),
    /** The `data`-schema snapshot (validated by the engine against the
     *  doc's dataSchema on the way IN — defense against host drift). */
    data: zJson,
    syncedAt: z.iso.datetime().optional(),
});
export type ResourceRow = z.infer<typeof zResourceRow>;

/** The query surface of `utils.resources.owned` / the host ResourceReader
 *  port: rows of ONE resource kind owned by the RUNNING workspace,
 *  optionally narrowed to one externalId. Empty array = owns none (never
 *  an error). */
export const zResourceQuery = z.strictObject({
    resource: zResourceId,
    externalId: z.string().min(1).optional(),
});
export type ResourceQuery = z.infer<typeof zResourceQuery>;
