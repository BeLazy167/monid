import { z } from "zod";
import { populationShape } from "../../../schema/population.ts";

/** `POST /v3/search/populations` body — the published v3
 *  `PopulationRequest`, mirrored faithfully (design D25). */
export const zPopulationSearchBody = z.object({
    request_id: z.string().max(200).optional().describe(
        "Idempotency key. The same id returns the same search; a different " +
            "population under that id answers `409`.",
    ),
    ...populationShape,
});
