/**
 * deno task engine:run <provider>#<endpoint> [--body '<json>']
 *                      [--query-params '<json>'] [--path-params '<json>']
 *
 * JIT: compile (or reuse the .output/ cache), pick the endpoint from the
 * bundle (sealUnit), execute it through Engine.load with directTransport
 * (credentials from env <NAME>_API_KEY), print the result including usage.
 *
 * ONE encoding: the flags ARE zRunInput's fields in CLI kebab-case
 * (cliffy maps --query-params → options.queryParams etc. — verbatim field
 * match, no escape hatch, no precedence rules).
 */
import { Command } from "@cliffy/command";
import { z } from "zod";
import {
    type Json,
    parseSchema,
    type ResourceRow,
    type RunInput,
    sealUnit,
    zResourceRow,
} from "@shared/core";
import { directTransport, Engine } from "@monid/connector-engine";
import { compileToOutput } from "./lib.ts";

function parseJson(flag: string, raw: string): Json {
    try {
        return JSON.parse(raw) as Json;
    } catch (error) {
        throw new Error(`${flag} is not valid JSON: ${error}`);
    }
}

const { options, args } = await new Command()
    .name("engine:run")
    .description(
        "Compile (cached) and execute one endpoint with env credentials.",
    )
    .arguments("<endpoint:string>")
    .option("--body <json:string>", "RunInput.body (JSON).")
    .option(
        "--query-params <json:string>",
        "RunInput.queryParams (JSON object).",
    )
    .option("--path-params <json:string>", "RunInput.pathParams (JSON object).")
    .option(
        "--resources <file:string>",
        "Owned-resource rows (a JSON file of ResourceRow[]) served to the " +
            "ownership window. Bound endpoints run against an EMPTY " +
            "window when omitted (foreign ids answer the uniform 404).",
    )
    .option(
        "--scope-key <key:string>",
        "The opaque scope token ensure fns see (default: local).",
    )
    .parse(Deno.args);

const endpointId = args[0];

const input: RunInput = {
    ...(options.body !== undefined
        ? { body: parseJson("--body", options.body) }
        : {}),
    ...(options.queryParams !== undefined
        ? {
            queryParams: parseJson(
                "--query-params",
                options.queryParams,
            ) as RunInput["queryParams"],
        }
        : {}),
    ...(options.pathParams !== undefined
        ? {
            pathParams: parseJson(
                "--path-params",
                options.pathParams,
            ) as RunInput["pathParams"],
        }
        : {}),
};

const { bundle, cacheHit } = await compileToOutput();
console.error(
    `[engine:run] ${
        cacheHit ? "cache hit" : "compiled"
    } — loading ${endpointId}`,
);

// the CLI's ownership window: fixture rows from --resources, else empty
// (bound endpoints still LOAD; ownership misses answer the uniform 404)
const rows: ResourceRow[] = options.resources !== undefined
    ? parseSchema(
        z.array(zResourceRow),
        JSON.parse(await Deno.readTextFile(options.resources)),
        `--resources ${options.resources}`,
    )
    : [];

const unit = sealUnit(bundle, endpointId);
const engine = new Engine({
    transport: directTransport(),
    resources: {
        owned: (query) =>
            Promise.resolve(
                rows.filter((row) =>
                    row.resource === query.resource &&
                    (query.externalId === undefined ||
                        row.externalId === query.externalId)
                ),
            ),
    },
    scopeKey: options.scopeKey ?? "local",
});
const loaded = await engine.load(unit);
// run() executes ensure() inline first (v1 ordering) and logs its seeds
const result = await loaded.run(input);

console.log(JSON.stringify(result, null, 2));
if (result.isProviderError) Deno.exit(1);
