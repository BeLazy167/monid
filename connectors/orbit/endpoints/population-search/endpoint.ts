import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zPopulationSearchBody } from "./schema/inputs.ts";

/**
 * `POST /v3/search/populations` — search a whole company or school.
 *
 * PASS-THROUGH, deliberately. A population runs to thousands of people and
 * fills over a long time; holding a monid run open for it would put an
 * unbounded wait behind a single call. The submit returns the search snapshot
 * with its `search_id`, and `orbit#v3/search/{search_id}` reads it — free,
 * append-only, as often as the caller likes.
 *
 * THE VENDOR'S CLAIM SETTLES IT (design D27), and it is exact: a population
 * search reserves its WHOLE cost as one number the moment it starts, and
 * reports that number on the snapshot as `population.credits_quoted`. Nothing
 * accrues afterwards, so the submit is the settle. The claim is plucked out
 * of the payload — it is a receipt, not data — and the derived fold below
 * only ever answers when Orbit reports no number at all.
 *
 * ESTIMATE is the ceiling the caller stated: `size` people at the depth
 * asked for. A caller who omits `size` is promising nothing, and gets a zero
 * estimate — which is what `orbit#v3/search/populations/quote` is for. It is
 * free, it is exact, and this endpoint's description says to call it first.
 */
export default defineEndpoint({
    meta: {
        displayName: "Search a Population",
        summary:
            "Search every employee of a company or every alumnus of a school.",
        description: "Search a whole population of people — every current " +
            "employee of a company, or every alumnus of a school — and " +
            "build each of them to the depth you choose. Reach for this " +
            "when the question is about a GROUP rather than a person: brief " +
            "an agent on an account team, research a company's people " +
            "before a meeting, or map a school's alumni in a field. The " +
            "call returns at once with a `search_id`; read " +
            "`orbit#v3/search/{search_id}` to follow the population filling " +
            "and to read the people as they become ready. The whole cost is " +
            "reserved as one number when the search starts and reported as " +
            "`population.credits_quoted` — call " +
            "`orbit#v3/search/populations/quote` first to see that number " +
            "for free, along with the most people one population search " +
            "covers.",
        docsUrl: "https://docs.orbitsearch.com/api/population-search",
        categories: ["people-enrichment"],
    },
    request: { method: "POST", path: "/v3/search/populations" },
    input: {
        schema: {
            body: zPopulationSearchBody.extend({
                profile_depth: zPopulationSearchBody.shape.profile_depth
                    .unwrap().default("partial"),
            }),
        },
    },
    timeouts: { requestMs: 120_000, runMs: 180_000 },
    usage: {
        /** Metered in Orbit's own credits, because that is the shape of the
         *  answer: Orbit prices a population as ONE number and reserves it
         *  up front. Splitting that back into per-person lines would be our
         *  arithmetic standing in for the vendor's. */
        model: {
            kind: UsageModelKind.PER_UNIT,
            unit: Unit.CREDIT,
            consumes: { credit: "default", amount: 1 },
            label: "population search",
            description:
                "the whole cost of the population search, reserved when it " +
                "starts",
        },
        /** The CEILING the caller stated: every person in a population of
         *  `size`, built at the depth asked for. `size` is the caller's own
         *  figure, so a caller who omits it promises nothing — the free
         *  quote is the exact answer. */
        estimate: ({ data }) => {
            const body = data.input.body;
            const size = body.size ?? 0;
            const rate = body.profile_depth === "full" ? 10 : 5;
            return { counts: { CREDIT: size * rate } };
        },
        /** Orbit's own reserved figure, read off the snapshot. */
        evidence: ({ data, utils }) => {
            const quoted = utils.json.optionalNum(
                data.output,
                "$.population.credits_quoted",
            );
            return { counts: quoted === undefined ? {} : { CREDIT: quoted } };
        },
    },
});
