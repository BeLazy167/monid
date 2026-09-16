import { assert, assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl } from "@std/path";
import type { Json, ResourceRow } from "@shared/core";
import { loadFixture, loadResource, testResourceUnit } from "@shared/testing";
import { EngineError, EngineErrorCode } from "@monid/connector-engine";

/**
 * saperly/phone-number resource ops through the COMPILED doc (the same
 * sealed-unit path the host drives): check before every rent charge,
 * idempotent release with the embedded-connection teardown, the
 * authoritative-pointer refresh, and the live sanitized external.
 */

const HERE = fromFileUrl(new URL("../../", import.meta.url));
const fixture = (name: string) => loadFixture(`${HERE}fixtures/${name}.json`);

const ROW: ResourceRow = {
    resource: "saperly/phone-number",
    externalId: "num-1",
    data: {
        phoneNumber: "+14155559999",
        country: "US",
        numberType: "local",
        externalRefs: { connection: "conn-1" },
    },
};

Deno.test("saperly resource: check — alive, with the observed price + period end", async () => {
    const resource = await loadResource({
        unit: await testResourceUnit("saperly/phone-number"),
        mode: "replay",
        fixture: await fixture("resource-check-active"),
    });
    assertEquals(await resource.check(ROW), {
        active: true,
        periodEndIso: "2026-10-16T00:00:00Z",
        observed: { consumes: { credit: "default", amount: 2 } },
    });
});

Deno.test("saperly resource: check — a released number is inactive with the reason", async () => {
    const resource = await loadResource({
        unit: await testResourceUnit("saperly/phone-number"),
        mode: "replay",
        fixture: await fixture("resource-check-released"),
    });
    const outcome = await resource.check(ROW);
    assertEquals(outcome.active, false);
    assertEquals(outcome.inactiveReason, "released_at:2026-09-15T00:00:00Z");
});

Deno.test("saperly resource: release — number + embedded connection teardown", async () => {
    const resource = await loadResource({
        unit: await testResourceUnit("saperly/phone-number"),
        mode: "replay",
        fixture: await fixture("resource-release"),
    });
    assertEquals(await resource.release(ROW), { released: true });
});

Deno.test("saperly resource: refresh — no connectionId upstream CLEARS the pointer", async () => {
    const resource = await loadResource({
        unit: await testResourceUnit("saperly/phone-number"),
        mode: "replay",
        fixture: await fixture("resource-refresh-clears-pointer"),
    });
    const outcome = await resource.refresh(ROW);
    assertEquals(outcome.active, true);
    const patch = outcome.patch as Record<string, Json>;
    assertEquals(patch.externalRefs, undefined); // authoritative clear
    // scalars carry forward on the degraded read
    assertEquals(patch.phoneNumber, "+14155559999");
    assertEquals(patch.country, "US");
});

Deno.test("saperly resource: the connection external is live and sanitized", async () => {
    const resource = await loadResource({
        unit: await testResourceUnit("saperly/phone-number"),
        mode: "replay",
        fixture: await fixture("resource-external-connection"),
    });
    const detail = await resource.external("connection", ROW) as Record<
        string,
        Json
    >;
    const connection = detail.connection as Record<string, Json>;
    assertEquals(connection.name, "Test persona");
    assertEquals(connection.id, undefined);
    assertEquals(connection.manualSecret, undefined);
});

Deno.test("saperly resource: no variable billing — actualCost refuses; foreign rows refused", async () => {
    const resource = await loadResource({
        unit: await testResourceUnit("saperly/phone-number"),
        mode: "replay",
        fixture: await fixture("resource-check-active"),
    });
    await assertRejects(
        () =>
            resource.actualCost(ROW, {
                startIso: "2026-09-01T00:00:00Z",
                endIso: "2026-09-16T00:00:00Z",
            }),
        EngineError,
        "no variable billing",
    );
    const foreign = await assertRejects(
        () => resource.check({ ...ROW, resource: "saperly/other" }),
        EngineError,
    );
    assertEquals(
        (foreign as EngineError).code,
        EngineErrorCode.INVALID_INPUT,
    );
});
