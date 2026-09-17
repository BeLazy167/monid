import { assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import {
    estimateEndpoint,
    loadFixture,
    runEndpoint,
    testSealedUnit,
} from "@shared/testing";

const chains = fromFileUrl(new URL("../../fixtures/", import.meta.url));

Deno.test("orbit#v3/search/populations: the reserved figure IS the settle", async () => {
    const unit = await testSealedUnit("orbit#v3/search/populations");
    const result = await runEndpoint({
        unit,
        input: {
            body: {
                population: {
                    kind: "company",
                    id: "1441",
                    name: "Northwind Instruments",
                },
                size: 140,
            },
        },
        mode: "replay",
        fixture: await loadFixture(`${chains}synthetic-population-search.json`),
    });

    assertEquals(result.httpStatus, 202);
    assertEquals(result.isProviderError, false);
    // Orbit reserves the whole cost when the search starts and reports it as
    // population.credits_quoted — there is nothing to accrue afterwards, so
    // the submit is the settle.
    assertEquals(result.usage, {
        credits: { default: 640 },
        evidence: { CREDIT: 640 },
    });
    // The call returns at once with the handle a caller reads it back by.
    const output = result.output as Record<string, unknown>;
    assertEquals(output.search_id, "POP1");
});

Deno.test("orbit#v3/search/populations estimate: the size the caller stated", async () => {
    const unit = await testSealedUnit("orbit#v3/search/populations");
    const stated = await estimateEndpoint(unit, {
        body: {
            population: { kind: "school", id: "9021", name: "Rhodes College" },
            size: 100,
            profile_depth: "full",
        },
    });
    assertEquals(stated.credits, { default: 1000 });

    // A caller who states no size promises nothing — the free quote is the
    // exact answer, and the endpoint's description says to call it first.
    const unstated = await estimateEndpoint(unit, {
        body: {
            population: { kind: "school", id: "9021", name: "Rhodes College" },
        },
    });
    assertEquals(unstated.credits, {});
});
