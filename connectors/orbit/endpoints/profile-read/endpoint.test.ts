import { assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import { loadFixture, runEndpoint, testSealedUnit } from "@shared/testing";

const chains = fromFileUrl(new URL("../../fixtures/", import.meta.url));
const PROFILE = "a23ff3b7-b6cc-4ac6-8d4f-0c909cd956f5";

Deno.test("orbit#v3/profile/{profile_id}: one flat credit, and the profile rides through whole", async () => {
    const unit = await testSealedUnit("orbit#v3/profile/{profile_id}");
    const result = await runEndpoint({
        unit,
        input: { pathParams: { profile_id: PROFILE } },
        mode: "replay",
        fixture: await loadFixture(`${chains}synthetic-profile-read.json`),
    });

    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, {
        credits: { default: 1 },
        evidence: { CALL: 1 },
    });
    const output = result.output as Record<string, unknown>;
    assertEquals(output.generation_level, 3);
});

Deno.test("orbit#v3/profile/{profile_id}: the identity is DECLARED, the call is the vendor's", async () => {
    const unit = await testSealedUnit("orbit#v3/profile/{profile_id}");
    // The read and the build share `/v3/enrich/{profile_id}` on Orbit's
    // side, and two defs on one path collide — so the read takes the name
    // Orbit's own `links.profile` gives it while still calling the vendor
    // path unchanged.
    assertEquals(unit.doc.id, "orbit#v3/profile/{profile_id}");
    assertEquals(unit.doc.request.method, "GET");
    assertEquals(
        unit.doc.request.url,
        "https://api.orbitsearch.com/v3/enrich/{profile_id}",
    );
});
