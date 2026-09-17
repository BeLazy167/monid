import { z } from "zod";
import { zConsumes } from "../usage/model/consumes.ts";
import { zUnit } from "../usage/unit.ts";
import { fnCarrier } from "../hooks/ctx.ts";
import type { HookLogger } from "../hooks/ctx.ts";
import type { ResourceOpUtils } from "./ops.ts";
import { zResourceRow, zResourceTarget } from "./row.ts";

/**
 * Resource BILLING — the declarative form of monid-services' shipped
 * mechanism (MON-298 `resource-billing-lifecycle`), design D31. Two money
 * streams, one period clock:
 *
 *   - `rent`: a SET price per period, charged IN ADVANCE. Period 1 is
 *     charged by the CREATING run's own usage model; every later period by
 *     the host at `periodEnd − chargeLeadMs`. Sticky; the host charges
 *     `max(card, seed.rentConsumes)`. `amount: 0` is a lawful FREE schedule
 *     (silent advance — sfs-class) and is also how variable-only resources
 *     get their settlement clock.
 *   - `variable`: the dynamic-cost stream (storage, compute, egress…) —
 *     a DISPLAY-ONLY price card, a hold-session cadence, a monetary runway
 *     `buffer`, and ONE cumulative `getActualCost` meter.
 *
 * The HOST owns when/whether (hold sessions, cadence grid, the strict
 * runway verdict, boundary/tail settlement, events); the doc owns HOW
 * (the upstream HTTP anatomy of the meter).
 */

/** Period anchoring (design D31/D38): CREATION_TIME = rolling from the
 *  provision moment (the v1 behavior — saperly, agentmail). CALENDAR =
 *  UTC calendar boundaries (midnight / the 1st) for vendors that invoice
 *  on calendar periods; the HOST rule: the FIRST period is the partial
 *  remainder from creation to the next boundary, then full periods
 *  tile. */
export const PeriodAnchor = {
    CREATION_TIME: "CREATION_TIME",
    CALENDAR: "CALENDAR",
} as const;
export type PeriodAnchor = (typeof PeriodAnchor)[keyof typeof PeriodAnchor];

export const zBillingPeriod = z.strictObject({
    unit: z.enum(["DAY", "WEEK", "MONTH", "YEAR"]),
    count: z.number().int().positive(),
    anchor: z.enum(PeriodAnchor).default(PeriodAnchor.CREATION_TIME),
});
export type BillingPeriod = z.infer<typeof zBillingPeriod>;

/** Rent consumes allows amount 0 (a free schedule IS a schedule) — unlike
 *  run-model `zConsumes`, whose lines exist only when they bill. */
export const zRentConsumes = z.strictObject({
    credit: z.string().min(1),
    amount: z.number().nonnegative(),
});
export type RentConsumes = z.infer<typeof zRentConsumes>;

export const zRent = z.strictObject({
    consumes: zRentConsumes,
    /** Start charging this long before the period end (v1 renewLead —
     *  saperly phone: 3 days). */
    chargeLeadMs: z.number().int().nonnegative(),
    /** Teardown lead on non-payment / user release (v1 releaseLead —
     *  saperly phone: 6 h, so the vendor never bills an unpaid cycle). */
    releaseLeadMs: z.number().int().nonnegative(),
});
export type Rent = z.infer<typeof zRent>;

/**
 * The metering window handed to `getActualCost` — ISO datetimes, half-open
 * `[startIso, endIso)`, CUMULATIVE: `startIso` is ALWAYS the usage period's
 * start, so the meter answers "cost consumed so far this period" and the
 * host never differences two readings. Three callers (v1-exact):
 *   - every hold-cadence tick   → [periodStart, now)
 *   - the usage-period boundary → [periodStart, periodEnd)   (the ONLY
 *     settle moment — runs even at $0; vendor cost recorded)
 *   - the release tail          → [periodStart, cutoff), cutoff AFTER the
 *     upstream teardown — the meter must tolerate post-mortem reads.
 */
export const zChargeWindow = z.strictObject({
    startIso: z.iso.datetime(),
    endIso: z.iso.datetime(),
});
export type ChargeWindow = z.infer<typeof zChargeWindow>;

/**
 * `getActualCost`'s answer — the VARIABLE bill for the window, in the
 * credits vocabulary (↔ v1 `VariableCost {amount, actualCost?}`):
 *   - `consumes`: the CUSTOMER bill, cumulative from the usage-period
 *     start. A $0 amount means "nothing consumed" — never "read failed"
 *     (a failed meter read THROWS: settle late, never silently $0).
 *   - `vendorConsumes`: the vendor's own cost, when readable; absent ⇒
 *     recorded equal to the bill.
 */
export const zActualCost = z.strictObject({
    consumes: zRentConsumes,
    vendorConsumes: zRentConsumes.optional(),
});
export type ActualCost = z.infer<typeof zActualCost>;

/** ctx.data for `getActualCost` — the target + the stored row + the
 *  cumulative window. The row rides for external refs (meter routes may
 *  hang off stored pointers); the LIVE truth comes from the read. */
export const zActualCostData = z.strictObject({
    target: zResourceTarget,
    row: zResourceRow,
    window: zChargeWindow,
});
export type ActualCostData = z.infer<typeof zActualCostData>;

export type ResourceCostFn = (
    ctx: {
        data: ActualCostData;
        utils: ResourceOpUtils;
        logger: HookLogger;
    },
) => Promise<ActualCost>;
export const zResourceCostFn = fnCarrier<ResourceCostFn>(
    "a billing.variable.getActualCost fn",
);

/** Hold-cadence floor: 1 hour (the v1 Temporal-history cap — no mid-period
 *  continueAsNew). */
export const HOLD_CADENCE_FLOOR_MS = 3_600_000;

export const zVariableBilling = z.strictObject({
    /** DISPLAY-ONLY price card (e.g. "$1 per GB_MONTH") — snapshotted for
     *  the user, NEVER computed against: the bill is getActualCost's
     *  answer. */
    price: z.strictObject({
        unit: zUnit,
        every: z.number().int().positive().default(1),
        consumes: zConsumes,
    }),
    /** Hold-session grow cadence — grid-anchored on the usage period
     *  (periodStart + k·cadence), derived, nothing persisted per tick. */
    holdCadenceMs: z.number().int().min(HOLD_CADENCE_FLOOR_MS),
    /** The RUNWAY: the session opens at exactly `buffer`; every tick grows
     *  it to `incurred + buffer` (never shrinks); unspent headroom returns
     *  at settle. This IS the "reasonable initial hold" — def-declared,
     *  never user input. */
    buffer: zConsumes,
    getActualCost: zResourceCostFn,
});
export type VariableBilling = z.infer<typeof zVariableBilling>;

export const zResourceBilling = z.strictObject({
    period: zBillingPeriod,
    rent: zRent.optional(),
    variable: zVariableBilling.optional(),
}).refine(
    (billing) => billing.rent !== undefined || billing.variable !== undefined,
    { message: "billing must declare rent and/or variable" },
).refine(
    (billing) => billing.variable === undefined || billing.rent !== undefined,
    {
        message: "variable billing requires rent — the period clock " +
            "(a $0 rent schedule is the lawful spelling)",
    },
);
export type ResourceBilling = z.infer<typeof zResourceBilling>;
