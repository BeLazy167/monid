import { assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import { loadFixture, runEndpoint, testSealedUnit } from "@shared/testing";

const chains = fromFileUrl(new URL("../../fixtures/", import.meta.url));

Deno.test("orbit#v3/search/populations/quote: an exact price, for free", async () => {
    const unit = await testSealedUnit("orbit#v3/search/populations/quote");
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
        fixture: await loadFixture(`${chains}synthetic-population-quote.json`),
    });

    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    const output = result.output as Record<string, unknown>;
    // The same number the search reserves, available before committing to it.
    assertEquals(output.credits, 640);
    assertEquals(output.max_people, 5000);
});
