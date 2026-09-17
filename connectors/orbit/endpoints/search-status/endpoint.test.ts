import { assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import { loadFixture, runEndpoint, testSealedUnit } from "@shared/testing";

const chains = fromFileUrl(new URL("../../fixtures/", import.meta.url));

Deno.test("orbit#v3/search/{search_id}: reading a search bills NOTHING", async () => {
    const unit = await testSealedUnit("orbit#v3/search/{search_id}");
    const result = await runEndpoint({
        unit,
        input: { pathParams: { search_id: "SEARCH1" } },
        mode: "replay",
        fixture: await loadFixture(
            `${chains}synthetic-search-status-read.json`,
        ),
    });

    // The search was billed by the run that started it. Re-reading its
    // snapshot — which a caller following a long search does repeatedly —
    // must never re-bill it.
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    const output = result.output as Record<string, unknown>;
    assertEquals(output.status, "completed");
});
