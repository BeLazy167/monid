import { assert, assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import {
    liveSkip,
    loadFixture,
    runEndpoint,
    testSealedUnit,
} from "@shared/testing";

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

Deno.test("orbit#v3/search/{search_id}: a vendor refusal is zero-billed data", async () => {
    const unit = await testSealedUnit("orbit#v3/search/{search_id}");
    const result = await runEndpoint({
        unit,
        input: { pathParams: { search_id: "UNKNOWN" } },
        mode: "replay",
        fixture: await loadFixture(
            `${chains}synthetic-search-status-error.json`,
        ),
    });

    assertEquals(result.httpStatus, 404);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    const output = result.output as Record<string, unknown>;
    assertEquals(output.code, "search_not_found");
});

Deno.test("orbit#v3/search/{search_id}: the id is required and is the whole input", async () => {
    const unit = await testSealedUnit("orbit#v3/search/{search_id}");
    const schema = unit.doc.input.schema;
    assertEquals(schema.pathParams?.required, ["search_id"]);
    assertEquals(schema.body, undefined);
    assertEquals(schema.queryParams, undefined);
    assert(
        unit.doc.request.url.endsWith("/{search_id}"),
        "the placeholder must survive url normalization unencoded",
    );
});

Deno.test({
    name:
        "orbit#v3/search/{search_id} live: an unknown id answers, and bills nothing",
    ignore: liveSkip("orbit"),
    fn: async () => {
        const unit = await testSealedUnit("orbit#v3/search/{search_id}");
        const result = await runEndpoint({
            unit,
            input: {
                pathParams: {
                    search_id: "00000000-0000-4000-8000-000000000000",
                },
            },
            mode: "live",
        });
        // Whichever way Orbit answers an id this key cannot see, a status
        // read is free.
        assertEquals(result.usage, { credits: {}, evidence: {} });
    },
});
