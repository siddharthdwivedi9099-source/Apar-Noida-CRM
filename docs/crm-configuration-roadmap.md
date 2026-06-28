# CRM Configuration Roadmap

A **safe, additive** plan to take the CRM from "configurable core + automations" to **fully configurable**, without rewriting the app or hard-coding workflows. Read alongside [configuration-engine-audit.md](./configuration-engine-audit.md).

---

> **Delivered since this roadmap was written:**
> - *Configuration-versioning phase* — the cross-cutting backbone: versioning/publishing/rollback, JSON import/export with dependency validation, a pure validation/safety engine, and a typed field-attributes contract.
> - *Apply-to-live phase* — publishing a version can now be **applied onto live config tables** (upsert-only, single transaction, validation-gated, with a pre-apply backup + audit), so configuration actually drives the app. **Still open here:** form-layout application and guarded orphan removal.
> - *Configuration-definitions phase* — a generic `configuration_definitions` registry now makes module metadata, objects, page layouts, business-process flows, approval matrices, notification rules, and dashboard compositions versioned, validated, published, and applied as governed configuration. Runtime rendering/execution remains intentionally layered on top in later phases.
> - *Core CRM metadata phase* — the requested CRM modules, core objects, relationships, flags, baseline views/forms, and standard picklists are seeded as configuration metadata rather than hard-coded UI/business logic.
> - *Persona access metadata phase* — 32 CRM personas, access policies, field/record/action permission metadata, and role-based page-layout definitions are seeded through the configuration engine. Enforcement of the richer record/field rules remains a later runtime phase.
> - *Business process flows phase* — all 6 CRM BPFs (Lead, Opportunity, Campaign, Partner, Support, Customer Success) are configured as governed `business_process_flow` definitions: every stage, order, required field, allowed/blocked transition, SLA/aging threshold, and notification/task/approval/AI-trigger reference is data, not hard-coded. The BPF contract gained entry/terminal flags and the validator enforces single-entry, terminal-no-outgoing, and reference integrity.
> - *BPF runtime + stage UI phase* — a pure transition validator (`validateBpfTransition`) + SLA/aging compute power a runtime service (`/bpf/:object/:recordId/state|history|transition`) over additive `bpf_record_state`/`bpf_stage_history` tables: stage transitions are enforced against the configured BPF (allow-list/blocked/default-deny, required-fields-by-stage, **closed-stage locking**, **backward-movement reason**, **manager override**), every change is recorded to history + audit. A reusable `StageProgress` component (stage bar, validation messages, aging/SLA indicator, history, override) is wired into the Lead and Opportunity detail pages. **Per-stage notification/approval dispatch and the remaining object detail pages are the next slice.**
> - *Lead config foundation phase (PROMPT 05.1)* — the full lead field catalog (designation, industry, region, segment, product interest, sub-source, UTM + first/latest-touch attribution, consent, fit/engagement/intent/AI scores, grade, qualification + disqualification status, SLA/assignment/follow-up dates) is configured on the lead `object` definition with searchable/filterable/reportable/AI-usable/sensitive/masking attributes, plus six new governed picklists (capture-source, sub-source, grade, qualification-status, disqualification-reason, consent-status). Configuration-only; scoring/assignment/dedup/conversion/UI are sub-phases 05.2–05.7.
> - *Lead scoring + MQL phase (PROMPT 05.2)* — `scoring_model` and `mql_rule` governed definition types + a pure evaluator (`evaluateLeadScore` → per-dimension scores, weighted final score, grade, and a matched/unmatched breakdown; `evaluateMql` → MQL decision with reasons). A default lead scoring model (fit/engagement/intent/AI) and MQL rule (threshold + required fields + consent criterion) are seeded as configuration. Rules/weights/grades/threshold are all data, not hard-coded. Runtime compute/history API folds into the lead runtime/UI slice.
> - *Lead assignment + SLA phase (PROMPT 05.3)* — `assignment_rule` and `sla_policy` governed definition types + pure resolvers (`resolveAssignmentRule` picks the first priority/condition-matching rule with its strategy + pool/target, else fallback; `computeSlaStatus` computes due time + ok/warning/breached/met per SLA target). Seeded a default lead assignment rule set (partner/segment/region/round-robin + fallback queue) and SLA policy (first-response 4h, follow-up 24h, manager escalation). Round-robin/load-balanced pool *selection* and breach dispatch are runtime concerns left to the lead runtime/worker slice.
> - *Lead runtime guidance phase (PROMPT 05.4)* — `GET /leads/:leadId/runtime` now composes active `scoring_model`, `mql_rule`, `assignment_rule`, and `sla_policy` definitions for a live lead and returns read-only scoring, MQL, assignment, and SLA guidance. The Lead detail page displays that guidance. It does **not** mutate ownership, persist score history, or dispatch SLA escalations yet; those remain worker/runtime-history slices.
> - *Lead conversion phase (PROMPT 05.5)* — `POST /leads/:leadId/convert` now performs the first conversion slice: it checks lead qualification readiness, runs duplicate detection for accounts and contacts, auto-links strong unambiguous matches or creates missing account/contact records, creates an opportunity plus a handoff task, updates the lead status to `converted`, and stores a conversion summary back on the lead. This is a deterministic operational flow, not a full merge console: fuzzy duplicate resolution and richer merge governance remain a later data-quality slice.
> - *Lead + account + opportunity custom-field values phase (Phase A vertical slice)* — `leads.custom_fields`, `accounts.custom_fields`, and `opportunities.custom_fields` are now persisted end-to-end. `POST/PATCH /leads`, `POST/PATCH /accounts`, and `POST/PATCH /opportunities` accept `customFields`, the corresponding detail endpoints return persisted custom-field values, the options endpoints return effective `fieldDefinitions` plus option catalogs for custom select/multiselect fields, the Lead, Account, and Opportunity form/detail UI now render and save active tenant-defined fields, and the lead runtime evaluator sees persisted lead custom fields without letting them override core system fields.
> - *Contact custom-field values phase (Phase A continuation)* — `contacts.custom_fields` is now persisted end-to-end on the same additive JSONB pattern. `POST/PATCH /contacts` accept `customFields`, the contact detail endpoint returns persisted values, `GET /contacts/options` returns effective `fieldDefinitions` plus option catalogs for custom select/multiselect fields, and the Contact form/detail UI render and save active tenant-defined fields. Reuses the shared `fieldDefinitions` + custom-field-options contract rather than a new payload shape, proving it as a platform pattern across four CRM entities.
> - *Support ticket custom-field values phase (Phase A — first non-CRM-service entity)* — `support_tickets.custom_fields` is persisted end-to-end (`entity_key = "support_ticket"`). The custom-field engine was extracted into a shared, entity-agnostic module (`apps/api/src/common/custom-fields.ts` — load definitions, build option catalogs, validate/merge values) so modules outside `CrmService` can adopt it without duplicating validation. `POST/PATCH /support/tickets` accept `customFields`, the ticket detail returns persisted values, `GET /support/options` returns effective `fieldDefinitions` plus option catalogs, and the support workspace renders/saves active tenant-defined fields via a reusable `CustomFieldInput` component. The shared engine has unit tests; the support exhaustive suite proves a ticket custom field round-trips through create + update.
> - *Partner custom-field values phase (Phase A continuation)* — `partners.custom_fields` is persisted end-to-end (`entity_key = "partner"`) on the shared `apps/api/src/common/custom-fields.ts` engine. `POST/PATCH /partners` accept `customFields`, the partner detail returns persisted values, `GET /partners/options` returns effective `fieldDefinitions` plus option catalogs, and the partner workspace renders/saves active tenant-defined fields and displays them on the detail card via the reusable `CustomFieldInput` component. The partner exhaustive suite proves a partner custom field round-trips through create + update. Custom fields now span six entities (lead, account, contact, opportunity, support ticket, partner).
> - *Inside Sales Representative phase (Persona 6 — ISR-001/002/004/006)* — the existing inside-sales workspace was extended on the configuration engine rather than hard-coded. ISR-001: the lead queue now surfaces configurable priority + hot-lead highlighting (derived from the lead scoring grade + the configured lead `sla_policy`), per-lead first-response SLA due time, product/solution context, and lead score/grade, and is sorted hottest/most-urgent first; `best_contact_recommendation` and `lead_summary` join the governed AI placeholders. ISR-002: a new tenant-configurable `lead-contact-script` option set drives guided first-contact scripts resolved per lead by product/source/persona (`resolveContactScript`), the `lead-call-disposition` set gained the `wrong_number`/`interested`/`callback_requested` outcomes, and logging a disposition auto-creates the configured next-step task from the disposition's `metadata.nextStep`. ISR-004: a new configurable `lead-qualification-checklist` option set (with `metadata.required`) replaces a hard-coded list — required items must be complete to mark a lead qualified unless an override reason is supplied, plus a qualification outcome and `qualification_outcome_suggestion` AI placeholder. ISR-006: disqualification now requires a reason from the configurable `disqualification-reason` set, routes `future_need` leads to nurture, and excludes disqualified leads from active SLA. All script/checklist/disposition logic is data (option-set values + metadata), seeded for new tenants and backfilled idempotently for existing tenants; pure resolvers live in `packages/types/src/lead-inside-sales.ts` with unit tests.
> - *Inside Sales Representative phase — completion (ISR-002 campaign + ISR-003 + ISR-005)* — closes the remaining Persona 6 gaps on the same engine. ISR-002: first-contact scripts gained a **campaign** targeting dimension (`metadata.campaignKey`, resolved from lead `campaignType`/`campaignKey` metadata) so scripts vary by product/campaign/source/persona. ISR-003: a new tenant-configurable `lead-cadence-step` option set (each value carries `metadata.channel` + `metadata.offsetHours`) drives a multi-channel contact cadence (call/email/sms/whatsapp/linkedin/follow-up) computed per lead by the pure `evaluateLeadCadence`; reps advance steps, pause with a mandatory reason, and log failed attempts — crossing the failed-attempt threshold auto-routes the lead to nurture; SLA-breach is surfaced as a per-lead `slaBreachAlert`. ISR-005: a new `lead-meeting-type` option set + `POST /sales-workspaces/leads/:leadId/meetings` books a meeting — it writes a `meeting` activity carrying agenda/participants/CRM-record link, creates a meeting task plus a reminder task, and moves the lead into a new configurable `meeting_scheduled` lead status; calendar-invite/email delivery remains a governed placeholder until the scheduling/outbound runtime lands. New option sets are seeded for new tenants and backfilled idempotently for existing ones; cadence + campaign resolvers are unit tested. Persona 6 (ISR-001–006) is now complete.
> - *Sales Development Representative phase (Persona 7 — SDR-001…006)* — extends the shared sales workspace + lead-runtime engine. SDR-001: account research (company profile, leadership, signals, talking points) is captured on the lead with logged sources + a visible confidence; AI generation is a governed placeholder. SDR-002: ICP fit is computed by the pure `evaluateIcpFit` over captured attributes (industry/segment/size/geography/use-case/budget/strategic-value) weighted by a configurable `lead-icp-criterion` set → high/medium/low band + an explanation breakdown, with an ICP fit distribution surfaced on the SDR dashboard. SDR-003: a configurable `lead-discovery-field` set drives a structured discovery form whose required fields are enforced before conversion (`evaluateDiscovery`); AI summary/follow-up email are placeholders. SDR-004: the existing `POST /leads/:leadId/convert` flow (account/contact create-or-link, duplicate detection, opportunity + handover task, status→converted) is surfaced as a workspace convert action. SDR-005: `POST /sales-workspaces/leads/:leadId/no-show` tracks a no-show count, creates a reschedule task, and routes the lead to nurture after the configured threshold. SDR-006: a configurable `lead-objection-type` set captures objections on the lead, with objection trends aggregated on the SDR dashboard; AI objection-handling content is a placeholder. New option sets seed for new tenants + backfill idempotently for existing ones; ICP + discovery resolvers (`packages/types/src/lead-sdr.ts`) are unit tested. Persona 7 (SDR-001–006) is now complete.
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

**Continue Phase A after the Lead + Account + Opportunity + Contact slices** by expanding the same custom-field persistence pattern to the next high-value CRM entities and then consuming the same field-definition contract in rendering:

1. Replicate the additive `custom_fields JSONB` pattern to the next CRM entities that already have custom-field metadata demand — Contacts, Support tickets, and Partners are now done (the last two on the shared `apps/api/src/common/custom-fields.ts` engine), so continue with the remaining commercially active modules (e.g. resellers, customer-success accounts, renewal/expansion) where the business case is strongest, reusing the shared engine.
2. Reuse the lead/account/opportunity `fieldDefinitions` + custom option-catalog contract as the schema-driven read path for those next entity form/detail screens instead of introducing new one-off payload shapes.
3. Once the read path is proven across more than one entity, layer Phase B validation rules and Phase C form-layout rendering on the same contract instead of inventing a separate field schema.
4. Keep extending the CRM exhaustive suite so each entity proves a custom field round-trips through create, update, options, and detail reads.

This keeps the momentum of the lead slice, reuses the same additive approach, and turns the new field-definition/value contract into a platform pattern rather than a one-off implementation.

**Explicitly not in the next phase:** new CRM business modules, dashboards-as-data, custom objects, or any change to existing tables' current columns.
