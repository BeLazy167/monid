import { z } from "zod";
import { parseSchema } from "../parse.ts";
import { type ResourceDef, type ResourceDefSeed, zResourceDef } from "./def.ts";
import type { Json } from "../json/type.ts";
import type { HookLogger } from "../hooks/ctx.ts";
import type { ActualCost, ChargeWindow } from "./billing.ts";
import type {
    CheckOutcome,
    RefreshOutcome,
    ReleaseOutcome,
    ResourceOpUtils,
} from "./ops.ts";
import type { ResourceTarget } from "./row.ts";

/** The op ctx with the ROW'S `data` typed as the def's own schema output
 *  (sound: the engine validates row.data against the compiled dataSchema
 *  before any op runs). */
export interface TypedResourceRow<Data> {
    resource: string;
    externalId: string;
    data: Data;
    syncedAt?: string;
}

export interface TypedResourceOpCtx<Data> {
    data: { target: ResourceTarget; row: TypedResourceRow<Data> };
    utils: ResourceOpUtils;
    logger: HookLogger;
}

export interface TypedResourceExternalCtx<Data> {
    data: {
        target: ResourceTarget;
        row: TypedResourceRow<Data>;
        args?: Json;
    };
    utils: ResourceOpUtils;
    logger: HookLogger;
}

export interface TypedActualCostCtx<Data> {
    data: {
        target: ResourceTarget;
        row: TypedResourceRow<Data>;
        window: ChargeWindow;
    };
    utils: ResourceOpUtils;
    logger: HookLogger;
}

type SeedBilling = NonNullable<ResourceDefSeed["billing"]>;
type SeedOps = ResourceDefSeed["ops"];

/**
 * defineResource — the parsed seed, with the ROW's `data` typed by the
 * def's OWN `data` schema across every op/billing/external fn (the D23
 * pattern: the type layer narrows, zod stays the runtime truth; the
 * engine's per-call row validation is the soundness anchor).
 */
export function defineResource<DataSchema extends z.ZodType>(
    seed:
        & Omit<ResourceDefSeed, "data" | "billing" | "ops" | "externals">
        & {
            data: DataSchema;
            billing?: Omit<SeedBilling, "variable"> & {
                variable?:
                    & Omit<
                        NonNullable<SeedBilling["variable"]>,
                        "getActualCost"
                    >
                    & {
                        getActualCost: (
                            ctx: TypedActualCostCtx<z.output<DataSchema>>,
                        ) => Promise<ActualCost>;
                    };
            };
            ops: Omit<SeedOps, "check" | "release" | "refresh"> & {
                check: (
                    ctx: TypedResourceOpCtx<z.output<DataSchema>>,
                ) => Promise<CheckOutcome>;
                release: (
                    ctx: TypedResourceOpCtx<z.output<DataSchema>>,
                ) => Promise<ReleaseOutcome>;
                refresh?: (
                    ctx: TypedResourceOpCtx<z.output<DataSchema>>,
                ) => Promise<RefreshOutcome>;
            };
            externals?: Record<
                string,
                {
                    read: (
                        ctx: TypedResourceExternalCtx<z.output<DataSchema>>,
                    ) => Promise<Json>;
                    display?: boolean;
                }
            >;
        },
): ResourceDef {
    return parseSchema(
        zResourceDef,
        seed as unknown as ResourceDefSeed,
        "defineResource",
    );
}
