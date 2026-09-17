import { z } from "zod";
import { personSearchShape } from "../../../schema/person-query.ts";

/**
 * `POST /v3/search` body — the faithful mirror of the published v3
 * `SearchRequest` (design D25): optionality only. Orbit's own documented
 * defaults (`limit` 20, `profile_depth` partial, `include_profile` true,
 * `candidate_discovery` false, `candidate_discovery_limit` 10) are applied at
 * the BINDING in endpoint.ts, so the estimate reads concrete numbers.
 */
export const zOrbitSearchBody = z.object({
    request_id: z.string().min(1).optional().describe(
        "Your idempotency key. Reuse it to retry the same logical search.",
    ),
    ...personSearchShape,
});
