# Tasks: refine-resource-model

## 1. Enums + estimate merge (W1)

- [ ] 1.1 `z.enum(ConstObject)` for `PeriodAnchor` (→ CREATION_TIME |
      CALENDAR), `ResourceInteraction`, `StopKind`.
- [ ] 1.2 `zEstimateData.elapsedMs?` + typed layer; doc/def
      `usage.updateEstimateEveryMs`; DELETE `usage.accrue` (schema,
      compiler, engine, docs); `accrued()` delegates to estimate;
      coherence: updateEstimateEveryMs ⇒ poll + metered.
- [ ] 1.3 Saperly place-calls/inbound-calls: merged estimate (60 s
      floor), `updateEstimateEveryMs: 30_000`; tests updated.

## 2. Resource shapes (W2)

- [ ] 2.1 `usage` rate card (`period` + `lines` fixed/estimated) +
      `reconcileUsage` sibling (`everyMs` floor 1 h, `get`); REQUIRED;
      `resourceUsage.free()` helper; leads/buffer/holdCadence deleted.
- [ ] 2.2 `ops` → `lifecycle` (`verify`/`release`/`refresh`);
      `ResourceRow` → `OwnedResource`; op ctx `{resource}` (target
      removed); reader/testing surfaces renamed.
- [ ] 2.3 `externals` → `views` (`{label?, read}`); `display` +
      `utils.external` deleted.
- [ ] 2.4 Compiler + engine (`RunnableResource.verify/reconcileUsage/
      view`) + saperly resource + tests updated.

## 3. Bindings (W3)

- [ ] 3.1 `resources:` purpose-keyed arrays (provisions/uses/updates/
      releases/reads) with per-purpose schemas, `as` aliases, ≤1
      provisions; compiled doc + fnKeysOf.
- [ ] 3.2 Engine: canonical gate order, `data.resources[alias]`
      injection into lifecycle fns, settle-mark union.
- [ ] 3.3 Compiler coherence (dead-key per entry, alias uniqueness,
      input ⊇ slot per purpose); saperly endpoints rewritten; tests.

## 4. Webhooks (W4)

- [ ] 4.1 Flatten (`account` wrapper dies); `correlate`+`dispatch` →
      `route` → `{who, what}`; verify.payload template (must contain
      ${rawBody}); resource-scope same shape (subscribe required there).
- [ ] 4.2 Compiler/doc shapes + saperly provider route fn + tests.

## 5. Slugs + identity lock (W5)

- [ ] 5.1 ResourceDef required `slug` (loader folder===slug); endpoint
      `endpoint:` required + def sweep across all connectors (docs
      byte-identical).
- [ ] 5.2 `connectors/ids.lock.json` + `scripts/ids-check.ts`
      (`deno task ids:check [--update]`).

## 6. Local host loop (W6)

- [ ] 6.1 `IResourceStore` port (provision/refresh/release/get/list +
      owned) + Deno KV adaptor (`scripts/store/kv.ts`; --unstable-kv in
      tasks).
- [ ] 6.2 `engine:run` wired to the store (seeds + effects persist;
      `--resources` overrides).
- [ ] 6.3 `scripts/webhook.ts simulate` (sign + verify + route +
      `--execute`) and `listen` behind `TunnelAdaptor`
      (cloudflared/tailscale/none).

## 7. Docs + verification (W7)

- [ ] 7.1 DEVELOPMENT.md Resources chapter rewrite; README/AGENT.md
      touch-ups; CLI reference rows.
- [ ] 7.2 Full gates: check/lint/test; byte-identical recompile of all
      pre-existing connectors; version:check; ids:check; openspec
      validate.
