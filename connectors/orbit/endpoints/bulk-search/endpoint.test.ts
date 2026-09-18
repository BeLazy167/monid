import { assert, assertEquals, assertRejects } from "@std/assert";
import type { Json } from "@shared/core";
import { fromFileUrl } from "@std/path";
import {
    assertInputAccepted,
    estimateEndpoint,
    liveSkip,
    loadFixture,
    runEndpoint,
    testSealedUnit,
} from "@shared/testing";

const chains = fromFileUrl(new URL("../../fixtures/", import.meta.url));

const twoRows: Json = {
    request_id: "contacts-import-2026-09-18",
    items: [
        { id: "csv-row-2", signals: { email: "person@example.com" }, limit: 1 },
        { id: "csv-row-3", query: "Ada Fielding, Northwind", limit: 1 },
    ],
};

Deno.test("orbit#v3/search/bulk: the job's own consumed total settles the run EXACTLY", async () => {
    const unit = await testSealedUnit("orbit#v3/search/bulk");
    const result = await runEndpoint({
        unit,
        input: { body: twoRows },
        mode: "replay",
        fixture: await loadFixture(`${chains}synthetic-bulk-job.json`),
    });

    assertEquals(result.httpStatus, 200);
    assertEquals(result.isProviderError, false);
    // The one exact bill in this connector. Every other billed endpoint
    // derives a lower bound from observation because Orbit reports no meter;
    // a bulk job reports `billing.consumed_credits`, and the claim wins.
    assertEquals(result.usage.credits, { default: 11 });
    assertEquals(result.usage.evidence, { CREDIT: 11 });
    // Claim and fold agree, so no mismatch rides out.
    assertEquals(result.usage.mismatch, undefined);
    const output = result.output as Record<string, unknown>;
    assertEquals(output.status, "completed");
    // The reservation stays visible as the job's own provenance.
    assertEquals(
        (output.billing as Record<string, unknown>).held_credits,
        0,
    );
});

Deno.test("orbit#v3/search/bulk: waiting_for_credits is SLOW, not finished", async () => {
    const unit = await testSealedUnit("orbit#v3/search/bulk");
    const result = await runEndpoint({
        unit,
        input: { body: twoRows },
        mode: "replay",
        fixture: await loadFixture(`${chains}synthetic-bulk-waiting.json`),
    });

    // Both `waiting_for_credits` and `needs_attention` keep the run alive —
    // Orbit resumes the first by itself and retries the second about every
    // five minutes, and a job in either state is still holding reserved
    // credits. Settling on them would abandon it.
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage.credits, { default: 6 });
    assertEquals(
        (result.output as Record<string, unknown>).status,
        "completed_with_errors",
    );
});

Deno.test("orbit#v3/search/bulk: a full queue is zero-billed data", async () => {
    const unit = await testSealedUnit("orbit#v3/search/bulk");
    const result = await runEndpoint({
        unit,
        input: { body: twoRows },
        mode: "replay",
        fixture: await loadFixture(`${chains}synthetic-bulk-queue-full.json`),
    });

    assertEquals(result.httpStatus, 409);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    assertEquals(
        (result.output as Record<string, unknown>).code,
        "bulk_search_queue_full",
    );
});

Deno.test("orbit#v3/search/bulk estimate: the ceiling, summed over every row", async () => {
    // Rates pinned from Orbit's own rate card —
    // GET https://api.orbitsearch.com/v2/developer/pricing, version
    // 2026-09-10: index_search 1 per 10 results, partial_profile 5,
    // full_profile 10.
    const unit = await testSealedUnit("orbit#v3/search/bulk");

    // Two rows at limit 1, partial: each is one cached block (1) plus one
    // partial build (5) = 6, so 12 for the pair.
    const small = await estimateEndpoint(unit, { body: twoRows });
    assertEquals(small, {
        credits: { default: 12 },
        evidence: { CREDIT: 12 },
    });

    // The number worth seeing before a real CSV runs: 500 rows at full depth
    // authorizes 500 x (1 + 10) = 5,500 credits.
    const csv = await estimateEndpoint(unit, {
        body: {
            request_id: "big-csv",
            items: Array.from({ length: 500 }, (_unused, index) => ({
                id: `row-${index}`,
                signals: { email: `person${index}@example.com` },
                limit: 1,
                profile_depth: "full",
            })),
        },
    });
    assertEquals(csv.credits, { default: 5500 });
});

Deno.test("orbit#v3/search/bulk: the vendor's caps are the mirror's caps", async () => {
    const unit = await testSealedUnit("orbit#v3/search/bulk");
    const body = unit.doc.input.schema.body as {
        properties?: Record<string, {
            minItems?: number;
            maxItems?: number;
            maxLength?: number;
            items?: {
                required?: string[];
                properties?: Record<string, { default?: unknown }>;
            };
        }>;
        required?: string[];
    };
    assertEquals(body.required, ["request_id", "items"]);
    assertEquals(body.properties?.items.minItems, 1);
    assertEquals(body.properties?.items.maxItems, 5000);
    assertEquals(body.properties?.request_id.maxLength, 128);
    // The caller's own row id is required — it is what makes the results
    // keyable back to a CSV.
    const item = body.properties?.items.items;
    assert(item?.required?.includes("id"), "item id is required");
    // Orbit's per-item defaults are materialized before any hook runs.
    assertEquals(item?.properties?.limit.default, 20);
    assertEquals(item?.properties?.profile_depth.default, "partial");
});

Deno.test({
    name:
        "orbit#v3/search/bulk live: a two-row job settles on the job's own meter",
    ignore: liveSkip("orbit"),
    fn: async () => {
        const unit = await testSealedUnit("orbit#v3/search/bulk");
        const result = await runEndpoint({
            unit,
            input: {
                body: {
                    request_id: `monid-live-${Date.now()}`,
                    items: [{
                        id: "live-row-1",
                        query: "Sam Altman",
                        limit: 1,
                    }],
                },
            },
            mode: "live",
        });
        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        // The bill comes from the job, so it IS assertable live: whatever
        // the row drew, the claim and the fold must be the same number.
        assertEquals(
            result.usage.credits,
            result.usage.evidence.CREDIT
                ? { default: result.usage.evidence.CREDIT }
                : {},
        );
    },
});

Deno.test("orbit#v3/search/bulk: the gate rejects a row with no id, and passes one with it", async () => {
    const unit = await testSealedUnit("orbit#v3/search/bulk");
    const fixture = await loadFixture(`${chains}synthetic-bulk-job.json`);

    // NEAR-VALID and bad: a perfectly good search that forgot the caller's
    // own row id — which is the field the whole CSV workflow keys on.
    await assertRejects(
        () =>
            runEndpoint({
                unit,
                input: {
                    body: {
                        request_id: "csv",
                        items: [{ query: "Ada Fielding", limit: 1 }],
                    },
                },
                mode: "replay",
                fixture,
            }),
        Error,
        "INVALID_INPUT",
    );

    await assertInputAccepted({
        unit,
        input: {
            body: {
                request_id: "csv",
                items: [{ id: "row-1", query: "Ada Fielding", limit: 1 }],
            },
        },
        mode: "replay",
        fixture,
    });
});
