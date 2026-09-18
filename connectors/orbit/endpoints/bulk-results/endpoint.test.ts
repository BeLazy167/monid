import { assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import { loadFixture, runEndpoint, testSealedUnit } from "@shared/testing";

const chains = fromFileUrl(new URL("../../fixtures/", import.meta.url));
const JOB = "3f2a91c4-5b6d-4e7f-8a9b-0c1d2e3f4a5b";

Deno.test("orbit#v3/search/bulk/{job_id}/results: rows come back on the caller's own ids, free", async () => {
    const unit = await testSealedUnit("orbit#v3/search/bulk/{job_id}/results");
    const result = await runEndpoint({
        unit,
        input: { pathParams: { job_id: JOB }, queryParams: { offset: 0 } },
        mode: "replay",
        fixture: await loadFixture(`${chains}synthetic-bulk-results-page.json`),
    });

    assertEquals(result.httpStatus, 200);
    // Paging 5,000 rows is 500 of these calls — they have to be free.
    assertEquals(result.usage, { credits: {}, evidence: {} });
    const rows = (result.output as Record<string, unknown>)
        .items as Record<string, unknown>[];
    // The caller's id is what makes this a CSV endpoint: it rides back on
    // the row, so answers key to source rows without matching on names.
    assertEquals(rows[0].id, "csv-row-2");
    assertEquals(rows[0].index, 0);
    // Unfinished rows page along with a null result, in input order.
    assertEquals(rows[1].id, "csv-row-3");
    assertEquals(rows[1].result, null);
});
