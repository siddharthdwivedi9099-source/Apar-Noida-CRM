# Configuration Engine Audit

**Status:** Inspection phase (read-only). No application code changed.
**Goal:** document how the Apar Noida AI-Native CRM is configured today, what the configuration engine can already do, and where the gaps are for a *fully* configurable CRM — without rewriting anything or hard-coding workflows.

---

## 1. Current architecture summary

**Monorepo** (npm workspaces) with a TypeScript backend and React frontend:

| Area | Location | Notes |
|------|----------|-------|
| **Backend API** | `apps/api` (Express, TypeScript, ESM) | 26 feature modules under `apps/api/src/modules/`; mounted under `/api/v1` by `apps/api/src/routes/v1.router.ts`. |
| **Frontend** | `apps/web` (React + Vite) | Route table is data-driven in the web app router; nav adapts to permissions + enabled modules. |
| **Shared types** | `packages/types` | Enums and request/response contracts (incl. the permission + module catalogs). |
| **Config constants** | `packages/config` | **Static platform metadata only** (name, API base path, ports) — *not* the tenant configuration engine. |
| **Database** | `packages/database` | PostgreSQL; 25 SQL migrations in `packages/database/migrations`; runner is `scripts/database.mjs`. |
| **Auth** | `packages/auth`, `apps/api/src/modules/auth` | JWT access/refresh, account lockout, secure cookies. |
| **AI** | `packages/ai`, `apps/api/src/modules/ai*` | Governed gateway, prompt/agent registries, AI actions, RAG. |

**Tenancy & access:** every record is tenant-scoped; RBAC (`module.action` permission codes) governs visibility and actions; sensitive events are written to `audit_logs`.

**The "configuration engine" is not a standalone package.** It is the **`tenant-config` module** (`apps/api/src/modules/tenant-config`) backed by a small set of generic, tenant-scoped tables. There is no monolithic config service to rewrite — extensions slot into this existing module.

---

## 2. How configuration is stored

Configuration lives in **generic, tenant-scoped tables** (not hard-coded). Three storage strategies are in use:

| Strategy | Tables | Used for |
|----------|--------|----------|
| **Key-value JSONB** | `system_settings` (`tenant_id`, `setting_key`, `setting_value` JSONB) | Core settings, theme/branding, module enable/disable, terminology. Keys: `tenant.settings`, `tenant.theme`, `tenant.modules`, `tenant.terminology`. |
| **Definition tables** | `tenant_option_sets`, `tenant_option_values`, `custom_field_definitions`, `custom_form_layouts` | Picklists/pipelines/stages, custom field definitions, form layout schemas (JSONB). |
| **Relational config** | `roles`, `permissions`, `role_permissions`, `user_roles` (RBAC); `workflows`, `workflow_actions`, `workflow_runs`, `workflow_logs` (automation); `dashboard_saved_views` (per-user dashboard prefs) | Access control, automations, saved dashboard views. |

All config tables carry `tenant_id`, soft-delete (`deleted_at`), audit columns (`created_by`/`updated_by`), and `updated_at` triggers. Source migrations: `…phase5_tenant_configuration.sql`, `…phase4_rbac.sql` + `…initial_foundation.sql`, `…phase24_workflow_engine.sql`, `…phase23_dashboards.sql`.

---

## 3. How each configuration surface works today

Legend: ✅ configurable as data · ⚠️ partial · ❌ code-defined / not wired.

| Surface | Storage | Configure via (API) | UI | Status |
|---------|---------|---------------------|----|--------|
| **Core settings** (workspace, timezone, locale, currency, date/time format) | `system_settings:tenant.settings` | `GET/PUT /tenant-config/settings` | `/admin` | ✅ |
| **Theme / branding** (colors, logo, mode, density, sidebar/card style, font) | `system_settings:tenant.theme` | `GET/PUT /tenant-config/theme` | `/admin/theme` | ✅ |
| **Modules on/off** | `system_settings:tenant.modules` | `GET/PUT /tenant-config/modules` | `/admin/modules` | ✅ *within a fixed 23-module catalog* |
| **Terminology** (rename objects per tenant) | `system_settings:tenant.terminology` | `GET/PUT /tenant-config/terminology` | `/admin/terminology` | ✅ |
| **Option sets / values** (statuses, stages, pipelines, sources, ticket statuses, CS stages) | `tenant_option_sets`, `tenant_option_values` | `GET /option-sets`, `PUT /option-sets/:setKey` | `/admin` | ✅ drives real CRM picklists (e.g. lead-status, opportunity-pipeline) |
| **Custom fields** | `custom_field_definitions` | `GET/POST/PATCH/DELETE /tenant-config/custom-fields` | `/admin/custom-fields` | ⚠️ **definitions only — values are not stored on records or rendered on business forms** |
| **Form layouts** | `custom_form_layouts` (`layout_schema` JSONB) | `GET /tenant-config/form-layouts` **(read-only)** | — | ⚠️ **no create/update/delete API; not rendered dynamically** |
| **Roles & permissions** | `roles`, `role_permissions`, `user_roles`, `permissions` | `/rbac/*` (roles CRUD, role permissions, user-role assignment, catalog) | `/admin/rbac` | ✅ roles fully configurable · ⚠️ the **permission/module catalog is a code enum** (`packages/types/src/rbac.ts`) seeded into `permissions` |
| **Workflows** (triggers → conditions → ordered actions; status draft/active/inactive) | `workflows`, `workflow_actions`, `workflow_runs`, `workflow_logs` | `/workflows/*` (CRUD, actions, run, runs) | `/workflows` | ✅ definitions fully configurable · ⚠️ **no automatic event dispatch** — manual `POST /:id/run` works; auto-firing on triggers is deferred (background workers) |
| **Dashboards** | `dashboard_saved_views` only | dashboards API (saved views) | `/analytics` | ❌ **dashboard + widget catalog is code-defined** (`dashboardCatalog`, `computeMetric` in `dashboard.service.ts`); only per-user saved views are data |
| **Validations** | partial (`custom_field_definitions.is_required` + `settings` JSONB) | — | — | ❌ **enforced by hard-coded Zod schemas per router**; no config-driven validation rules applied to records |

---

## 4. Existing configuration-engine capabilities (what already works well)

- **Multi-tenant, data-driven core config** — settings, theme, terminology, and module on/off are all per-tenant data, not code. Disabling a module removes it from navigation tenant-wide.
- **Configurable picklists and pipelines** — `tenant_option_sets/values` back real business choices (lead status/source, opportunity pipeline, ticket status, CS stage). The education seed uses these, proving they drive behaviour.
- **Configurable RBAC** — roles and their `module.action` grants are fully editable data; the UI adapts to whatever a role is granted.
- **Configurable automations** — workflows (trigger + conditions + ordered actions, including `run_ai_prompt` / `run_ai_agent`) are stored as data and editable via API/UI, with run history. Nothing about workflows is hard-coded into business logic.
- **Governed AI as configuration** — prompts and agents are versioned, approvable registry data referenced by key, not hard-coded strings.
- **Safe foundations** — every config table is tenant-scoped, soft-deletable, audited, and has `updated_at` triggers; the `system_settings` KV table is a ready-made home for new config blobs.

---

## 5. Gaps for a *fully* configurable CRM

Ordered by impact. Each is an **additive** gap — the foundation exists; the wiring or write-path is missing.

1. **Custom-field values are not persisted or rendered (highest impact).** `custom_field_definitions` exist, but there is **no `custom_field_values` storage** and business entity services/forms don't read/write custom fields. Result: custom fields can be *defined* but are *non-functional* end-to-end.
2. **Form layouts are read-only and not rendered.** The `custom_form_layouts` table + `layout_schema` exist and there's a `GET`, but no create/update/delete API and no dynamic form renderer consuming the schema.
3. **Validation is not configurable.** Rules live in per-router Zod schemas (code). `is_required` is stored but not enforced (values aren't stored). No place to define/enforce tenant-level field validation (required, min/max, regex, cross-field).
4. **Dashboards are code-defined.** Widgets and metrics come from a code `dashboardCatalog` + `computeMetric`. Tenants can save views/filters but cannot define dashboards, widgets, or metrics as data.
5. **Module & permission catalog is a code enum.** `permissionModuleKeys` (23 modules) and the 13 action verbs are compiled constants seeded into `permissions`. A genuinely new module/permission still requires a code change + reseed (you can configure *within* the taxonomy, not extend the taxonomy as data).
6. **Workflow auto-dispatch is deferred.** Definitions are configurable, but triggers (`record_created`, `stage_changed`, `ai_score_changed`, …) do not auto-fire; only manual runs execute. Needs an event/worker layer (already on the deferred roadmap).
7. **Entity/object schema is fixed (long-term).** CRM objects (leads, accounts, opportunities, …) are concrete tables. Defining a brand-new *object* purely as configuration would require a metadata-driven entity layer — a large, separate initiative, explicitly out of scope for near-term phases.

> Cross-reference: items 1, 2, 6 are already acknowledged in `KNOWN_LIMITATIONS.md` ("dynamic custom-field/form-layout rendering"; "background workers"). This audit adds items 3, 4, 5, 7 and a safe sequencing.

---

## 6. Constraints honoured

- **No existing work deleted or rewritten.** Every gap is closed by *adding* to the `tenant-config` module and *additive* migrations.
- **No hard-coded CRM workflows.** Recommendations keep automations as data in the workflow engine.
- **Backward-compatible by default.** New config tables are optional; services fall back to today's behaviour (code catalogs/Zod) when no tenant config exists.
- **Future-configurable.** Each extension widens what is data-driven without locking schema decisions.

---

## 7. Exact files inspected

**Structure / build:** `package.json`, `tsconfig.base.json`, `docker-compose.yml`, `render.yaml`, `apps/api/src/app.ts`, `apps/api/src/routes/v1.router.ts`, `apps/api/src/server.ts`.

**Config engine (storage + service):**
- `packages/config/src/index.ts`
- `packages/database/migrations/20260615143000_initial_foundation.sql` (tenants, users, roles, permissions, role_permissions, user_roles, system_settings, audit_logs)
- `packages/database/migrations/20260616100000_phase5_tenant_configuration.sql` (option sets/values, custom_field_definitions, custom_form_layouts)
- `packages/database/migrations/20260615160000_phase4_rbac.sql` (role_templates, role_template_permissions)
- `packages/database/migrations/20260624050000_phase24_workflow_engine.sql` (workflows, workflow_actions, workflow_runs, workflow_logs)
- `packages/database/migrations/20260623050000_phase23_dashboards.sql` (dashboard_saved_views)
- `apps/api/src/modules/tenant-config/tenant-config.router.ts`
- `apps/api/src/modules/tenant-config/tenant-config.service.ts`

**Configuration surfaces:**
- `apps/api/src/modules/rbac/rbac.router.ts`, `packages/types/src/rbac.ts`
- `apps/api/src/modules/workflows/workflows.router.ts`, `apps/api/src/modules/workflows/workflow.service.ts`, `packages/types/src/workflows.ts`
- `apps/api/src/modules/dashboards/dashboards.router.ts`, `apps/api/src/modules/dashboards/dashboard.service.ts`
- `apps/api/src/modules/ai/ai-gateway.router.ts`, `apps/api/src/modules/ai/ai-registry.router.ts`, `apps/api/src/modules/crm/crm.router.ts`

**Cross-reference docs:** `KNOWN_LIMITATIONS.md`, `POST_RELEASE_ROADMAP.md`, `docs/DOCUMENTATION_INDEX.md`.

---

*Next: see [crm-configuration-roadmap.md](./crm-configuration-roadmap.md) for the safe, phased plan to close these gaps.*
