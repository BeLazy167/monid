import { z } from "zod";
import { populationShape } from "../../../schema/population.ts";

/** `POST /v3/search/populations/quote` body — the published v3
 *  `PopulationQuoteRequest`, mirrored faithfully (design D25). */
export const zPopulationQuoteBody = z.object({ ...populationShape });
