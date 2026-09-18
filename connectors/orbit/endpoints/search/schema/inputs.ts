import { z } from "zod";
import { personQueryShape } from "../../../schema/person-query.ts";

/**
 * `POST /v3/search` body — the faithful mirror of the published v3
 * `SearchRequest` (design D25). Orbit's own documented defaults are applied
 * at the BINDING in endpoint.ts, so the estimate reads concrete numbers.
 *
 * Carries at least one of `query`, `intent` or `signals`; Orbit answers a
 * request satisfying none of them with a `400`, which arrives as data.
 */
export const zOrbitSearchBody = z.object({
    request_id: z.string().min(1).optional().describe(
        "Your idempotency key. Reuse it to retry the same logical search.",
    ),
    ...personQueryShape,
});
