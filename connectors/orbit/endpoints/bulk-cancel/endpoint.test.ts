import { assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import { loadFixture, runEndpoint, testSealedUnit } from "@shared/testing";

const chains = fromFileUrl(new URL("../../fixtures/", import.meta.url));
const JOB = "3f2a91c4-5b6d-4e7f-8a9b-0c1d2e3f4a5b";

Deno.test("orbit#v3/search/bulk/{job_id}/cancel: stopping a job is free, and does not re-bill it", async () => {
    const unit = await testSealedUnit(
        "orbit#v3/search/bulk/{job_id}/cancel",
    );
    const result = await runEndpoint({
        unit,
        input: { pathParams: { job_id: JOB } },
        mode: "replay",
        fixture: await loadFixture(`${chains}synthetic-bulk-cancel.json`),
    });

    assertEquals(result.httpStatus, 200);
    // The cancel response IS the job, consumed total and all — the same
    // re-bill trap the status read carries.
    assertEquals(result.usage, { credits: {}, evidence: {} });
    const output = result.output as Record<string, unknown>;
    assertEquals(output.status, "canceled");
    assertEquals(output.cancel_requested, true);
});
