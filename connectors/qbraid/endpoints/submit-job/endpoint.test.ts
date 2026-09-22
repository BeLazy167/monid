import { assert, assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import {
    estimateEndpoint,
    liveSkip,
    loadFixture,
    runEndpoint,
    testSealedUnit,
} from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));
const ID = "qbraid#submit-job";
const BELL =
    'OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[2];\ncreg c[2];\nh q[0];\ncx q[0],q[1];\nmeasure q -> c;\n';
const INPUT = {
    body: {
        deviceQrn: "qbraid:qbraid:sim:qir-sv",
        shots: 10,
        name: "monid-fixture-bell",
        program: { format: "qasm2", data: BELL },
    },
};

const run = async (fixture: string, input = INPUT) =>
    await runEndpoint({
        unit: await testSealedUnit(ID),
        input,
        mode: "replay",
        fixture: await loadFixture(`${fixturesDir}${fixture}.json`),
    });

Deno.test(`${ID} happy (recorded): free simulator — zero claim prunes, receipt consolidated away`, async () => {
    const result = await run("happy");
    assertEquals(result.httpStatus, 201);
    assertEquals(result.isProviderError, false);
    // claim 0 (D27: zero entries prune) + evidence CREDIT 0
    assertEquals(result.usage, { credits: {}, evidence: { CREDIT: 0 } });
    const output = result.output as Record<string, unknown> & {
        data: Record<string, unknown>;
    };
    assertEquals(output.success, true);
    assertEquals(output.data.status, "INITIALIZING");
    assertEquals(typeof output.data.jobQrn, "string");
    // the receipt left the payload — it lives in usage.credits
    assertEquals("estimatedCost" in output.data, false);
});

Deno.test(`${ID} priced: the vendor's estimatedCost claim wins, fold agrees exactly`, async () => {
    const result = await run("synthetic-priced", {
        body: { ...INPUT.body, deviceQrn: "aws:aqt:qpu:ibex-q1", shots: 100 },
    });
    assertEquals(result.httpStatus, 201);
    // 265 credits claimed; 265 000 000 millionths × 0.000001 folds to 265
    // within 1e-9, so NO mismatch key rides out (zUsage is strict)
    assertEquals(result.usage, {
        credits: { default: 265 },
        evidence: { CREDIT: 265_000_000 },
    });
});

Deno.test(`${ID}: 201 + success:false becomes a 502 and bills NOTHING`, async () => {
    const result = await run("synthetic-rejected-201");
    assertEquals(result.httpStatus, 502);
    assertEquals(result.providerHttpStatus, 201);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
});

for (
    const [fixture, status, code] of [
        ["provider-error", 401, "INVALID_API_KEY_FORMAT"],
        ["device-not-found", 404, "NOT_FOUND"],
    ] as const
) {
    Deno.test(`${ID} provider error ${status}: data, zero usage, digested`, async () => {
        const result = await run(fixture);
        assertEquals(result.httpStatus, status);
        assertEquals(result.isProviderError, true);
        assertEquals(result.usage, { credits: {}, evidence: {} });
        assertEquals((result.output as Record<string, unknown>).code, code);
    });
}

Deno.test(`${ID} estimate promises nothing — the price is a device fact`, async () => {
    const usage = await estimateEndpoint(await testSealedUnit(ID), INPUT);
    assertEquals(usage, { credits: {}, evidence: {} });
});

Deno.test(`${ID}: program accepts one program or a batch; format is required`, async () => {
    const unit = await testSealedUnit(ID);
    const body = unit.doc.input.schema.body as {
        required?: string[];
        properties: Record<string, unknown>;
    };
    assertEquals(body.required, ["deviceQrn", "shots", "program"]);
    assert(JSON.stringify(body.properties.program).includes("anyOf"));
});

Deno.test({
    name:
        `${ID} live (gated on QBRAID_CREDENTIALS_API_KEY): 10 free shots on the QIR simulator`,
    ignore: liveSkip("qbraid"),
    fn: async () => {
        const result = await runEndpoint({
            unit: await testSealedUnit(ID),
            input: INPUT,
            mode: "live",
        });
        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        // the free simulator quotes 0: the claim prunes, evidence is 0
        assertEquals(result.usage, { credits: {}, evidence: { CREDIT: 0 } });
    },
});
