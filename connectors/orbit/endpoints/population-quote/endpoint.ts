import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPopulationQuoteBody } from "./schema/inputs.ts";

/**
 * `POST /v3/search/populations/quote` — price a population search before
 * running it.
 *
 * FREE, and the endpoint to call FIRST. A population search reserves its whole
 * cost as one number the moment it starts, and this route returns that number
 * — plus `max_people`, the most people one population search covers — without
 * starting anything. An agent working to a budget quotes, then decides.
 */
export default defineEndpoint({
    meta: {
        displayName: "Quote a Population Search",
        summary:
            "Price a whole company or school population before searching it.",
        description: "Get the exact credit price of a population search " +
            "before running one — every current employee of a company, or " +
            "every alumnus of a school, each built to the depth you choose. " +
            "The answer carries `credits` (the whole cost as one number, " +
            "the same figure the search reserves when it starts), " +
            "`max_people` (the most people one population search covers), " +
            "and the `pricing_version` the quote used. Free. Quote first " +
            "when the budget matters, then run " +
            "`orbit#v3/search/populations` with the same population and " +
            "depth.",
        docsUrl: "https://docs.orbitsearch.com/api/population-quote",
        categories: ["people-enrichment"],
    },
    request: { method: "POST", path: "/v3/search/populations/quote" },
    input: {
        schema: {
            body: zPopulationQuoteBody.extend({
                profile_depth: zPopulationQuoteBody.shape.profile_depth.unwrap()
                    .default("partial"),
            }),
        },
    },
    timeouts: { requestMs: 30_000, runMs: 60_000 },
    usage: { model: { kind: UsageModelKind.FREE } },
});
