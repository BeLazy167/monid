import { assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import {
    estimateEndpoint,
    loadFixture,
    runEndpoint,
    testSealedUnit,
} from "@shared/testing";

const chains = fromFileUrl(new URL("../../fixtures/", import.meta.url));
const PROFILE = "a23ff3b7-b6cc-4ac6-8d4f-0c909cd956f5";

Deno.test("orbit#v3/enrich/{profile_id}: a dispatched full build settles 10", async () => {
    const unit = await testSealedUnit("orbit#v3/enrich/{profile_id}");
    const result = await runEndpoint({
        unit,
        input: {
            pathParams: { profile_id: PROFILE },
            body: { operation: "full" },
        },
        mode: "replay",
        fixture: await loadFixture(`${chains}synthetic-enrich-built.json`),
    });

    assertEquals(result.httpStatus, 200);
    assertEquals(result.isProviderError, false);
    assertEquals(result.usage, {
        credits: { default: 10 },
        evidence: { full_profile: 1 },
    });
    const output = result.output as Record<string, unknown>;
    assertEquals(output.status, "completed");
    assertEquals(output.generation_level, 3);
});

Deno.test("orbit#v3/enrich/{profile_id}: a profile already at depth settles ZERO", async () => {
    const unit = await testSealedUnit("orbit#v3/enrich/{profile_id}");
    const result = await runEndpoint({
        unit,
        input: {
            pathParams: { profile_id: PROFILE },
            body: { operation: "full" },
        },
        mode: "replay",
        fixture: await loadFixture(`${chains}synthetic-enrich-noop.json`),
    });

    // THE regression this file exists for. The snapshot reports
    // generation_level 3 and status completed — identical to the built case
    // — and the ONLY thing separating them is that Orbit never dispatched.
    // A settle keyed on the depth reached would bill 10 credits for a read.
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    assertEquals(
        (result.output as Record<string, unknown>).generation_level,
        3,
    );
});

Deno.test("orbit#v3/enrich/{profile_id}: a refusal is zero-billed data", async () => {
    const unit = await testSealedUnit("orbit#v3/enrich/{profile_id}");
    const result = await runEndpoint({
        unit,
        input: {
            pathParams: { profile_id: PROFILE },
            body: { operation: "partial" },
        },
        mode: "replay",
        fixture: await loadFixture(
            `${chains}synthetic-enrich-provider-error.json`,
        ),
    });

    assertEquals(result.httpStatus, 402);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
});

Deno.test("orbit#v3/enrich/{profile_id} estimate: the depth asked for, once", async () => {
    const unit = await testSealedUnit("orbit#v3/enrich/{profile_id}");
    const partial = await estimateEndpoint(unit, {
        pathParams: { profile_id: PROFILE },
        body: { operation: "partial" },
    });
    assertEquals(partial, {
        credits: { default: 5 },
        evidence: { partial_profile: 1 },
    });

    // `regenerate` rebuilds, so it is priced as the full build it is.
    const regenerate = await estimateEndpoint(unit, {
        pathParams: { profile_id: PROFILE },
        body: { operation: "regenerate" },
    });
    assertEquals(regenerate, {
        credits: { default: 10 },
        evidence: { full_profile: 1 },
    });
});
