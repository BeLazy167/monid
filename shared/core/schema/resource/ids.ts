import { z } from "zod";

/**
 * Resource doc identity — "<provider>/<name>", both lowercase kebab-case
 * (design D30). The name is INFERRED from the resource's folder
 * (`connectors/<provider>/resources/<name>/`), never authored — the
 * endpoint-id convention, applied to resources.
 */
export const zResourceId = z.string().regex(
    /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/,
    "resource id must be <provider>/<name> (lowercase kebab-case)",
);
export type ResourceId = z.infer<typeof zResourceId>;

export const zResourceName = z.string().regex(
    /^[a-z0-9][a-z0-9-]*$/,
    "resource FOLDER name must be lowercase kebab-case",
);
export type ResourceName = z.infer<typeof zResourceName>;
