# Configuration Engine — Usage Guide

How to change CRM behaviour through **configuration** rather than code, and how the configuration engine keeps changes safe, versioned, and portable.

> Read alongside [configuration-engine-audit.md](./configuration-engine-audit.md) (what exists) and [crm-configuration-roadmap.md](./crm-configuration-roadmap.md) (what's next). This guide documents the engine delivered in the configuration-versioning phase.

---

## What the engine gives you

The configuration engine sits **on top of** the existing `tenant-config` surfaces (settings, theme, modules, terminology, option sets, custom fields, form layouts) and adds the cross-cutting capabilities that make configuration safe to evolve:

| Capability | Endpoint | Permission |
|------------|----------|------------|
| **Export** current config as a portable JSON snapshot | `GET /api/v1/configuration/export` | `admin.view` / `admin.configure` |
| **Validate** the live config (referential integrity + completeness) | `GET /api/v1/configuration/validate` | `admin.view` / `admin.configure` |
| **List** governed configuration definitions | `GET /api/v1/configuration/definitions?definitionType=dashboard` | `admin.view` / `admin.configure` |
| **Get** one configuration definition | `GET /api/v1/configuration/definitions/:type/:key` | `admin.view` / `admin.configure` |
| **Upsert** one configuration definition | `PUT /api/v1/configuration/definitions/:type/:key` | `admin.edit` / `admin.configure` |
| **Delete** one configuration definition | `DELETE /api/v1/configuration/definitions/:type/:key` | `admin.delete` / `admin.configure` |
| **List** saved versions | `GET /api/v1/configuration/versions` | `admin.view` / `admin.configure` |
| **Get** one version (with its full snapshot + issues) | `GET /api/v1/configuration/versions/:id` | `admin.view` / `admin.configure` |
| **Save a draft** (from current config or a supplied snapshot) | `POST /api/v1/configuration/versions` | `admin.edit` / `admin.configure` |
| **Publish** a draft (validation-gated) | `POST /api/v1/configuration/versions/:id/publish` | `admin.configure` / `admin.approve` |
| **Rollback** (new draft from a historical version) | `POST /api/v1/configuration/versions/:id/rollback` | `admin.configure` / `admin.approve` |
| **Import** a snapshot (validate / dependency errors / stage) | `POST /api/v1/configuration/import` | `admin.edit` / `admin.configure` |
| **Apply-plan** (dry-run preview of the upserts) | `GET /api/v1/configuration/versions/:id/apply-plan` | `admin.view` / `admin.configure` |
| **Apply** a published version onto live config tables | `POST /api/v1/configuration/versions/:id/apply` | `admin.configure` / `admin.approve` |

Everything is **tenant-scoped, soft-deletable, and audited** (events land in `audit_logs` with `event_type = 'configuration'`).

---

## The configuration snapshot

A snapshot is the unit of export, import, and every saved version. It carries a `schemaVersion` so future imports can detect and migrate older formats.

```jsonc
{
  "schemaVersion": 1,
  "exportedAt": "2026-06-30T10:00:00.000Z",
  "settings":    { /* TenantCoreSettings */ },
  "theme":       { /* TenantThemeSettings */ },
  "modules":     [ /* TenantModuleState[]  */ ],
  "terminology": [ /* TenantTerminologyEntry[] */ ],
  "optionSets":  [ /* TenantOptionSet[] (picklists/pipelines/stages) */ ],
  "customFields":[ /* CustomFieldDefinition[] */ ],
  "formLayouts": [ /* CustomFormLayoutDefinition[] */ ],
  "definitions": [ /* ConfigurationDefinition[] */ ]
}
```

`definitions` is the generic registry for newer CRM configuration objects such as module metadata, objects, page layouts, business-process flows, approval matrices, notification rules, dashboard compositions, personas, and access policies. These rows can be managed directly through `/configuration/definitions/*`, and they are also versioned, validated, published, imported/exported, and applied like the rest of the snapshot. Runtime execution/rendering for those newer types is intentionally layered on top in later phases.

The core CRM metadata seed registers the baseline CRM module/object catalog through this same registry: module metadata, object labels, ownership models, key fields, relationships, activity/audit/reporting flags, and basic list/detail/create-edit view metadata. It also adds standard picklists through `tenant_option_sets`. This remains metadata-only; business workflow execution and dynamic UI rendering are later phases.

The persona access seed registers 32 CRM personas, role-linked access policies, and role-based page-layout metadata through the registry. These definitions describe object-level actions, field visibility/editability/masking, record scopes, special actions, sensitive-data notes, and per-persona layouts without hard-coding those rules into UI components or business services. Runtime enforcement of the richer field/record rules remains a follow-on phase.

---

## Versioning, publishing & rollback (Category 11)

Versions follow a strict state machine — `draft → published → archived` — enforced by `canTransitionConfigurationVersion`:

```
draft ──► published ──► archived
  └────────────────────► archived
```

- **Save draft** captures the current (or an imported) snapshot, runs validation, and stores the issues alongside it. `version_number` is monotonic per tenant.
- **Publish** re-validates and is **blocked if there are validation errors** (HTTP 422 with the issue list). On success it stamps `published_by`, `published_at`, and `effective_date`, and **archives the previously published version** — a DB partial unique index guarantees at most one published version per tenant.
- **Rollback** never mutates history; it creates a **new draft** from a chosen historical snapshot (`changeReason: "Rollback to v{n}"`) which you then review and re-publish.
- **Audit:** `configuration.draft_created`, `configuration.published`, `configuration.publish_blocked` are written to `audit_logs`.

> The version record is the configuration's audit history: who created/published it, when, the change reason, and the exact snapshot.

---

## Safety & validation (Category 13)

`validateConfigurationSnapshot` is a **pure function** (unit-tested, no DB) used by export, import, and publish. It returns structured `{ valid, errorCount, warningCount, issues[] }`. Current checks:

| Code | Severity | Catches |
|------|----------|---------|
| `MISSING_OPTION_SET_REFERENCE` | error | A field points at an option set that doesn't exist |
| `SELECT_WITHOUT_OPTION_SET` | error | A select/multiselect field with no option set |
| `DUPLICATE_FIELD_KEY` | error | Two fields share a key on one entity |
| `OPTION_SET_NO_ACTIVE_VALUES` | error (pipelines) / warning | A picklist/pipeline with no usable values |
| `MULTIPLE_DEFAULT_VALUES` | error | More than one default in an option set |
| `LAYOUT_UNKNOWN_FIELD` | error | A layout references a missing `custom.<field>` |
| `MASKING_WITHOUT_SENSITIVE` | warning | Masking set on a non-sensitive field |
| `UNKNOWN_TERMINOLOGY_MODULE` | warning | Terminology for a module not in the snapshot |
| `DEFINITION_MISSING_FIELD` | error | A registry definition is missing required payload fields |
| `DUPLICATE_DEFINITION_KEY` | error | Two registry definitions share the same type/key |
| `BPF_INVALID_TRANSITION` | error | A business-process flow transition references an unknown stage |
| `APPROVAL_INVALID_MODE` | error | An approval matrix uses an unsupported approval mode |
| `NOTIFICATION_INVALID_CHANNEL` | error | A notification rule uses an unsupported channel |
| `NOTIFICATION_INVALID_FREQUENCY` | error | A notification rule uses an unsupported frequency |
| `PERSONA_INVALID_OBJECT_PERMISSIONS` | error | A persona definition is missing a valid object-permission map |
| `PERSONA_INVALID_FIELD_PERMISSIONS` | error | A persona definition is missing a valid field-permission map |
| `PERSONA_INVALID_RECORD_SCOPES` | error | A persona definition does not define record scopes |
| `ACCESS_POLICY_INVALID_FIELD_PERMISSIONS` | error | An access policy is missing field-level permissions |
| `UNSUPPORTED_SCHEMA_VERSION` | error | Imported snapshot newer than this build supports |

**Publishing incomplete configuration is prevented** — errors block publish; warnings are surfaced but allowed.

---

## Import / export & environment promotion (Category 12)

- **Export** (`GET /export`) returns the snapshot **plus** its summary and a validation report — ready to commit to source control or move between environments.
- **Import** (`POST /import`) accepts a snapshot and:
  - with `"dryRun": true` → validates and returns dependency/issue report **without** writing anything;
  - otherwise → validates (rejecting on errors) and stages the snapshot as a new **draft** for review before publish.

This is the **dev → staging → production promotion** path: export from one environment, dry-run import in the next to catch dependency errors, then import + publish.

---

## Applying a published version onto live config

Publishing approves a snapshot; **applying** writes it onto the live config tables so it actually drives the app. `POST /configuration/versions/:id/apply`:

1. **Gate** — the version must be `published`; its snapshot is re-validated and apply is **blocked on errors**.
2. **Backup** — current live config is captured as a new **draft** (`"Pre-apply backup before applying v{n}"`) so you can roll back.
3. **Apply (single transaction, upsert-only)** — settings, theme, modules, terminology (`system_settings`), then option sets/values, custom fields, and configuration definitions. **Option sets are applied before custom fields** so option-set references resolve. Apply **never deletes** live config (create/update only); any failure rolls the whole apply back automatically.
4. **Stamp + audit** — `applied_at`/`applied_by` are recorded and a `configuration.applied` audit event is written with per-section counts.

Preview first with `GET /configuration/versions/:id/apply-plan` — a pure, upsert-only diff returning `{ operations[], createCount, updateCount, noopCount }`.

> **Scope:** apply currently covers settings, theme, modules, terminology, option sets, custom fields, and the generic configuration-definition registry, including persona/access-policy metadata. **Form-layout application is deferred** (form layouts have no writer yet), and runtime enforcement/rendering for the new definition types comes in later phases.

---

## Configurable field attributes (Category 3)

Richer field behaviour is a typed contract (`CustomFieldSettings`) stored inside the existing `custom_field_definitions.settings` JSONB — **no schema change required**. Set these via the existing `POST/PATCH /api/v1/tenant-config/custom-fields` `settings` object:

```jsonc
"settings": {
  "helpText": "Internal use only",
  "defaultValue": "North",
  "isSearchable": true,
  "isFilterable": true,
  "isReportable": true,
  "isAiUsable": false,
  "isSensitive": true,
  "maskingRule": "partial",          // none | partial | full | email
  "visibilityRule": { /* future */ },
  "editabilityRule": { /* future */ }
}
```

`normalizeCustomFieldSettings` applies safe defaults and rejects invalid masking rules; the validator warns when masking is set on a non-sensitive field.

---

## How future CRM changes are made through configuration

| To change… | Do this (no code) |
|------------|-------------------|
| Which modules/objects appear | `PUT /tenant-config/modules` (toggle) → re-export → publish |
| Object/field labels | `PUT /tenant-config/terminology` |
| Picklists, stages, pipelines | `PUT /tenant-config/option-sets/:setKey` |
| Custom fields + their attributes | `POST/PATCH /tenant-config/custom-fields` (incl. `settings` contract) |
| Roles & permissions | `/rbac/*` |
| Workflows / automations | `/workflows/*` |
| Ship a vetted config to another environment | `GET /configuration/export` → `POST /configuration/import?dryRun` → import → publish |
| Undo a bad change | `POST /configuration/versions/:id/rollback` → review → publish |

Each change can be **captured as a version, validated, published behind a safety gate, and rolled back** — configuration is now a governed, auditable artifact, not ad-hoc state.

---

## What is intentionally still code (and why)

Applying a published snapshot onto live tables is **now implemented** (upsert-only, transactional, with a backup point) for settings, theme, modules, terminology, option sets, custom fields, and the generic configuration-definition registry. Still on the roadmap: **form-layout application** (needs a layout writer), **guarded orphan removal** (apply is deliberately upsert-only today), page-layout authoring UI/rendering, data-driven dashboard runtime, business-process flow enforcement, approval-matrix execution, and notification dispatch. The snapshot/version/validate/apply foundation is designed for them to plug into.
