import { defineProvider, presets } from "@shared/core";

/**
 * Orbit (orbitsearch.com) — the deepest available context about a PERSON.
 * JSON over HTTP against `https://api.orbitsearch.com`, bearer auth with an
 * `sk_orb_` key, one public version: v3.
 *
 * Three shapes live behind that one host:
 *
 *   - SYNC reads — a profile read, a status poll, a price quote. One request,
 *     one answer.
 *   - ASYNC WORK — search and enrich. The submit answers `202` with a
 *     snapshot carrying the id and `status: "running"`; the caller polls the
 *     matching status route until the status is terminal. Four endpoints
 *     carry a lifecycle so ONE monid run returns finished work; the status
 *     routes stay exposed for callers who would rather drive the poll
 *     themselves or resume a run started elsewhere.
 *   - BULK — up to 5,000 searches as one durable job, read back by page.
 *
 * THE LIFECYCLE IS NOT ON THE PROVIDER. A provider-level `start` replaces
 * declarative execution on the SYNC endpoints too, and eight of this
 * connector's twelve endpoints are plain requests. Each async endpoint
 * authors its own phases.
 *
 * BILLING — Orbit publishes its rate card at `GET /v2/developer/pricing`,
 * unauthenticated, and the lines below are pinned from version `2026-09-10`:
 *
 *   profile_read         1  per profile read
 *   index_search         1  per 10 results returned from the Orbit index
 *   candidate_discovery  1  per profile discovery returns
 *   partial_profile      5  per profile built to partial depth
 *   full_profile        10  per profile built to full depth
 *
 * A search settles as a COMPOSITE of those lines rather than a flat fee,
 * because that is the algebra Orbit itself settles on: results already at the
 * requested depth draw only their share of an `index_search` block, and a
 * profile Orbit had to BUILD draws 5 or 10 on top. An enrich that finds the
 * profile already at the requested depth is a no-op and settles at zero.
 *
 * Search and enrich responses carry NO meter, so those endpoints ship without
 * a `usage.consolidate` (design D27 — the hook is optional) and the derived
 * fold settles them. TWO endpoints DO report a vendor claim and declare one:
 * a bulk job reports `billing.consumed_credits`, and a population search
 * reports `population.credits_quoted`.
 *
 * LINES NOT MODELED, and why (the D29 completeness rule):
 *   - `watcher_run` (1) and `watcher_update` (5) accrue on Orbit's own
 *     schedule AFTER the call that created the watcher returns, so a monid
 *     run can never settle them. The watcher surface is held back until the
 *     two platforms agree how a recurring charge settles; see the proposal.
 *   - `face_search` (100) rides an identity signal that is absent from the
 *     published request schema.
 *   - The company lines (`company_search`, `company_profile`,
 *     `company_enrichment`, `company_discovery`, `company_briefing`,
 *     `person_company_graph`) price routes that the public v3 document does
 *     not carry yet.
 * Orbit publishes the rate card as JSON at a stable URL, so these pins are
 * checkable against the vendor's own surface on demand.
 */
export default defineProvider({
    name: "orbit",
    meta: {
        displayName: "Orbit",
        summary:
            "The most in-depth, source-backed context about a person, for deep personalization and research.",
        description: "Orbit gives an agent the deepest available context " +
            "about a PERSON — who they are, what they have done, what they " +
            "care about, and the sources behind every claim. Find someone " +
            "from a plain-English description, a name, an email, a phone " +
            "number, an address, a handle, or a profile URL; then read a " +
            "profile that carries identity, contact and work facts plus " +
            "generated sections on their background, interests and recent " +
            "activity, each attributed to the source it came from. Use it " +
            "to choose a gift a friend will actually like, to learn about " +
            "someone before meeting them, to brief yourself on a client, or " +
            "to research a person properly. Depth is the caller's choice: " +
            "`partial` is a useful profile in seconds, `full` is the " +
            "deepest profile Orbit can build.",
        homepageUrl: "https://orbitsearch.com",
        docsUrl: "https://docs.orbitsearch.com",
        categories: ["people-enrichment"],
    },
    auth: { inject: presets.auth.bearer() },
    request: { baseUrl: "https://api.orbitsearch.com" },
    /** Reads answer in well under a second; the async submits answer 202 fast
     *  and the WORK is what takes time. `runMs` is the whole-run budget a
     *  polled search or enrich lives inside — a full-depth profile is built
     *  from live sources and minutes is the honest figure. `pollMs` matches
     *  the cadence Orbit's own status routes are written for. */
    timeouts: { requestMs: 60_000, runMs: 900_000, pollMs: 5_000 },
    usage: {
        /** THE credit system (design D26): Orbit meters in its OWN credits.
         *  The published packages price every tier at $0.01/credit flat
         *  ($10/1,000 through $200/20,000), so the conversion is a constant —
         *  and it stays the broker card's job rather than a number pinned
         *  into the doc. */
        credits: {
            default: {
                label: "Orbit credits",
                description:
                    "Orbit credits, bought in packages from $10 for 1,000; " +
                    "`GET /v2/developer/pricing` serves the live rate card",
            },
        },
    },
    output: {
        /** Orbit's error envelope is `{status: "failed", error: {code,
         *  message}}`, with `requiredCredits`/`remainingCredits` alongside on
         *  a 402. Vendor non-2xx is DATA — the engine zero-bills it — and the
         *  machine `code` is the part an agent branches on
         *  (`developer_api_credits_insufficient`, `invalid_api_key`,
         *  `profile_not_found`). */
        fromError: ({ data, utils }) => {
            const message = utils.json.optionalGet(
                data.output,
                "$.error.message",
            );
            const code = utils.json.optionalGet(data.output, "$.error.code");
            return {
                message: typeof message === "string" && message !== ""
                    ? message
                    : "Orbit API error",
                ...(typeof code === "string" ? { code } : {}),
                raw: data.output,
            };
        },
    },
});
