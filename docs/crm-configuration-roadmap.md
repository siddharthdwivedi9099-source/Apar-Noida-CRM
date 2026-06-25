# CRM Configuration Roadmap

A **safe, additive** plan to take the CRM from "configurable core + automations" to **fully configurable**, without rewriting the app or hard-coding workflows. Read alongside [configuration-engine-audit.md](./configuration-engine-audit.md).

---

> **Delivered since this roadmap was written:**
> - *Configuration-versioning phase* — the cross-cutting backbone: versioning/publishing/rollback, JSON import/export with dependency validation, a pure validation/safety engine, and a typed field-attributes contract.
> - *Apply-to-live phase* — publishing a version can now be **applied onto live config tables** (upsert-only, single transaction, validation-gated, with a pre-apply backup + audit), so configuration actually drives the app. **Still open here:** form-layout application and guarded orphan removal.
> - *Configuration-definitions phase* — a generic `configuration_definitions` registry now makes module metadata, objects, page layouts, business-process flows, approval matrices, notification rules, and dashboard compositions versioned, validated, published, and applied as governed configuration. Runtime rendering/execution remains intentionally layered on top in later phases.
>
> See [configuration-engine.md](./configuration-engine.md). These precede the per-entity work below because they make every subsequent phase publishable, validatable, reversible, and live-applicable. Phases A–G remain as written; they now plug into the snapshot/version/validate/apply foundation.

## Guiding principles

1. **Additive only** — new tables and endpoints extend the existing `tenant-config` module; no destructive migrations, no table drops, no rewrites.
2. **Backward-compatible fallback** — every new config layer is *optional*. When a tenant has no config rows, services behave exactly as they do today (code catalogs / Zod schemas). Existing tenants are unaffected until they opt in.
3. **Config-as-data, never hard-coded** — automations, validations, layouts, and dashboards become tenant data referenced by key; code provides defaults and execution, not business rules.
4. **One write-path per concern** — reuse `system_settings` (KV) and the existing definition tables; add a new table only when a blob can't model relationships or query needs.
5. **Tenant-scoped, audited, soft-deletable** — match the conventions already on every config table (`tenant_id`, `deleted_at`, `created_by/updated_by`, `updated_at` trigger).
6. **Ship behind reads first** — land schema + read APIs + seed-from-code before any UI/rendering, so nothing breaks mid-flight.

---

## Phased plan (priority order)

Effort is rough (S ≤ 2d, M ≈ 3–5d, L ≈ 1–2w). Each phase is independently shippable.

### Phase A — Make custom fields functional end-to-end **(highest value, M)**

*Closes gap #1 (and unblocks #2, #3).*

- **Schema (additive):** add custom-field **value** storage. Preferred: a per-entity `custom_fields JSONB` column on business tables (e.g. `leads`, `accounts`, `opportunities`) — least invasive, no joins. Alternative: a single `custom_field_values` EAV table (`tenant_id`, `entity_key`, `record_id`, `field_id`, `value`) if you need typed querying.
- **Service:** in each entity's create/update path, read `custom_field_definitions` for that `entity_key` and read/write the values; ignore unknown keys. No business table is restructured.
- **Read API:** expose effective field set (system + custom) per entity so the frontend can render.
- **Backward-compat:** entities with no custom-field definitions behave exactly as today.
- **Tests:** extend the tenant-config exhaustive script; add an API test that a defined field round-trips on a record.

### Phase B — Configurable validations **(M)**

*Closes gap #3; depends on A.*

- **Schema:** reuse the existing `custom_field_definitions.settings` JSONB for rules (`required`, `min`, `max`, `minLength`, `maxLength`, `regex`, `options`); optionally add a `validation_rules` table for cross-field/entity-level rules.
- **Service:** a single server-side validator reads rules and enforces them in entity create/update, returning the platform's standard `VALIDATION_ERROR` shape. Zod stays as the transport-level guard; config rules layer on top.
- **Backward-compat:** no rules ⇒ no extra enforcement.

### Phase C — Form-layout write + dynamic rendering **(M)**

*Closes gap #2; depends on A.*

- **API:** add `POST/PUT/DELETE /tenant-config/form-layouts` to the existing router/service (`custom_form_layouts` already stores `layout_schema`). Mirror the custom-field permission gates (`admin.create/edit/delete/configure`).
- **Frontend:** a schema-driven form renderer that consumes `layout_schema` (sections → fields, system + custom) with a safe default layout when none exists.
- **Backward-compat:** no layout ⇒ current static forms.

### Phase D — Data-driven dashboards **(L)**

*Closes gap #4.*

- **Schema:** `dashboard_definitions` and `dashboard_widgets` (tenant-scoped), plus a **metric registry** that maps a `metricKey` to a vetted, parameterised query (metrics stay code-defined for safety; *composition* becomes data).
- **Service:** `dashboard.service` resolves a tenant's dashboards from data and falls back to the current code `dashboardCatalog` when none exist. `dashboard_saved_views` continues to work unchanged.
- **Guardrail:** widgets reference registered `metricKey`s only — no arbitrary SQL from config.

### Phase E — Extensible module & permission catalog **(M)**

*Closes gap #5.*

- **Schema:** a `module_registry` table seeded from today's `permissionModuleKeys`; permissions continue to live in `permissions` but can be **registered** for a new module key as data.
- **Service:** RBAC and module-toggle read the registry (seeded from the code enum, so current behaviour is identical) — enabling new modules to appear without editing the enum.
- **Backward-compat:** the code enum becomes the *seed*, not the only source.

### Phase F — Workflow auto-dispatch **(L, infra-gated)**

*Closes gap #6; aligns with the deferred "background workers" in `POST_RELEASE_ROADMAP.md`.*

- **Approach:** emit domain events from entity services to an event/outbox table; a worker matches active workflows by `trigger_type` + conditions and executes the existing action pipeline (already implemented for manual runs). Honour the existing human-approval gates for sensitive AI actions.
- **Guardrail:** ships disabled by default (`BACKGROUND_WORKERS_ENABLED=false`), so nothing auto-fires until explicitly enabled.

### Phase G — Metadata-driven custom objects **(L+, long-term, optional)**

*Closes gap #7.* Define brand-new objects (not just fields) as configuration. Large initiative (dynamic schema/storage, listing, permissions, API generation). **Recommend deferring** until A–E prove the configuration model; document as a north-star, not a near-term commitment.

---

## Sequencing summary

```
A (custom-field values)  ──►  B (validations)
        │                         └─► C (form layouts + renderer)
        ▼
   D (dashboards)   E (module/permission registry)   F (workflow auto-dispatch)
                                                        │
                                                        ▼
                                              G (custom objects — long-term)
```

A is the keystone (it unblocks B and C and delivers visible value fastest). D, E, F are independent and can run in parallel after A. G is intentionally last/optional.

---

## Recommended next phase

**Phase A — custom-field values end-to-end**, scoped initially to **one entity (Leads)** as a vertical slice:

1. Add an additive migration: `leads.custom_fields JSONB NOT NULL DEFAULT '{}'` (no change to existing columns).
2. In the Leads create/update service, merge validated custom-field values (defined in `custom_field_definitions` for `entity_key = 'lead'`) into that column; ignore undefined keys.
3. Return the effective field set (system + custom) on the Leads read endpoints.
4. Extend the tenant-config exhaustive test + add a Leads API test proving a defined custom field round-trips.

This is small, fully additive, reversible, and immediately makes the already-built custom-field admin UI *do something* — the highest-leverage first step. Once proven on Leads, replicate the pattern entity-by-entity, then layer B (validation) and C (rendering) on the same foundation.

**Explicitly not in the next phase:** new CRM business modules, dashboards-as-data, custom objects, or any change to existing tables' current columns.
