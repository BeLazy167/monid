import { z } from "zod";
import { zRunInput } from "../run/input.ts";
import { zUsageModel } from "../usage/model/mod.ts";
import { zFnUsage } from "../usage/usage.ts";
import { fnCarrier, zFnUtils, zHookLogger } from "./ctx.ts";

/**
 * HOOK usage.accrue — the MID-RUN cost curve (design D35): elapsed run
 * time → the quantities consumed SO FAR, in the model's own metered keys.
 * PURE + sync, the estimate's mid-flight sibling: `estimate` promises the
 * whole run, `accrue` prices a moment inside it, `evidence` settles the
 * truth. The engine folds the counts (+ the declared buffer headroom)
 * through the SAME usage model as estimate/settle — one rate card, three
 * moments. Hosts drive it (`accrued(elapsedMs)`, pure — no vendor
 * round-trip) to grow the admission hold on a cadence, so an in-flight
 * metered run (a live phone call) can never outrun its hold by more than
 * `intervalMs + buffer`. Declaring accrue REQUIRES lifecycle.poll: only a
 * pollable run has a mid-flight to price.
 */
export const zAccrueData = z.strictObject({
    /** Milliseconds since the run's admitted start (host clock). */
    elapsedMs: z.number().nonnegative(),
    input: zRunInput,
    /** The doc's own usage section facts — `data.usage.model`. */
    usage: z.strictObject({ model: zUsageModel }),
});
export type AccrueData = z.infer<typeof zAccrueData>;

export const zAccrueCtx = z.object({
    data: zAccrueData,
    utils: zFnUtils,
    logger: zHookLogger,
});

export const UsageAccrueContract = z.function({
    input: [zAccrueCtx],
    output: zFnUsage,
});
export type UsageAccrueFn = z.infer<typeof UsageAccrueContract>;
export const zUsageAccrueFn = fnCarrier<UsageAccrueFn>("a usage.accrue fn");

/**
 * The accrue DECLARATION (def + doc `usage.accrue`): the fn + its cadence
 * + the fixed headroom the host adds on top of every reading (in UNITS
 * per metered key — saperly: 60 s of talk-time on a 30 s cadence, so the
 * hold always leads the meter).
 */
export const zAccrueSection = z.strictObject({
    /** Host hold-grow cadence. */
    intervalMs: z.number().int().positive(),
    counts: zUsageAccrueFn,
    /** Extra UNITS added per metered key on every accrued() reading. */
    buffer: z.record(z.string().min(1), z.number().nonnegative())
        .optional(),
});
export type AccrueSection = z.infer<typeof zAccrueSection>;
