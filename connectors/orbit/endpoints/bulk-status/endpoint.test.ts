import { assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import { loadFixture, runEndpoint, testSealedUnit } from "@shared/testing";

const chains = fromFileUrl(new URL("../../fixtures/", import.meta.url));
const JOB = "3f2a91c4-5b6d-4e7f-8a9b-0c1d2e3f4a5b";

Deno.test("orbit#v3/search/bulk/{job_id}: reading a job bills NOTHING", async () => {
    const unit = await testSealedUnit("orbit#v3/search/bulk/{job_id}");
    const result = await runEndpoint({
        unit,
        input: { pathParams: { job_id: JOB } },
        mode: "replay",
        fixture: await loadFixture(`${chains}synthetic-bulk-status-read.json`),
    });

    // THE regression this file exists for: the body says consumed 11 — the
    // WHOLE job — and reading it must still cost zero, or a caller following
    // a long job re-buys it on every tick.
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    const billing = (result.output as Record<string, Record<string, unknown>>)
        .billing;
    // The meter stays in the output as the job's own provenance.
    assertEquals(billing.consumed_credits, 11);
});
