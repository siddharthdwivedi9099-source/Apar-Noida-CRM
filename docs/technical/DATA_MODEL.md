# Data Model

## Purpose

This document describes the implemented database model after Phase 10.

## Implemented Scope

The database now covers:
- tenant identity and isolation
- tenant-scoped users, teams, departments, and roles
- global permission catalog and role templates
- tenant role and user-role assignment
- authentication sessions
- audit logging
- system settings
- tenant option sets and option values
- custom field definitions
- custom form layouts
- leads
- accounts
- contacts
- opportunities
- opportunity stakeholders
- campaigns
- campaign members
- social posts
- social post channels
- shared CRM notes
- shared CRM activities
- shared CRM tasks
- shared CRM timeline events
- migration and seed tracking

## Modeling Standards

### Tenant Scope

- tenant-owned tables carry `tenant_id`
- composite or tenant-aware foreign keys are used where practical to preserve isolation
- global vocabulary tables such as `permissions` and `role_templates` remain tenant-independent

### Timestamps

Mutable tables use:
- `created_at`
- `updated_at`
- `deleted_at`

`updated_at` is maintained by the shared `set_row_updated_at()` trigger function.

### Actor Tracking

Where applicable, mutable tables also include:
- `created_by`
- `updated_by`
- `owner_id`

Additional productivity tracking fields include:
- `author_user_id` on notes and activities
- `assignee_user_id` on tasks

### Metadata

Extensible tables include:

```text
metadata JSONB NOT NULL DEFAULT '{}'::jsonb
```

This keeps tenant-specific and future module-specific extensions out of the fixed relational columns.

### Soft Delete Pattern

The standard pattern is:
- set `deleted_at`
- keep operational queries filtered to `deleted_at IS NULL`
- preserve historical rows for auditability and future recovery logic

`audit_logs` remains append-only and intentionally does not use soft delete.

## Implemented Tables

| Table | Scope | Purpose |
| --- | --- | --- |
| `tenants` | global | Primary logical isolation boundary |
| `users` | tenant | Login identity and operator profile foundation |
| `teams` | tenant | Operational grouping for ownership and reporting |
| `departments` | tenant | Organizational hierarchy |
| `roles` | tenant | Reusable authorization bundles |
| `permissions` | global | Canonical permission catalog |
| `role_permissions` | tenant | Role-to-permission assignment |
| `user_roles` | tenant | User-to-role assignment |
| `role_templates` | global | Seeded role blueprints |
| `role_template_permissions` | global | Permission bundles for templates |
| `auth_sessions` | tenant | Refresh token storage and session tracking |
| `audit_logs` | tenant or global | Immutable security and admin audit trail |
| `system_settings` | tenant or global | JSONB-backed settings storage |
| `tenant_option_sets` | tenant | Configurable dropdown, stage, and status catalogs |
| `tenant_option_values` | tenant | Values inside a tenant option set |
| `custom_field_definitions` | tenant | Tenant-managed custom field metadata |
| `custom_form_layouts` | tenant | Tenant-managed form layout metadata |
| `leads` | tenant | Lead identity, source, status, owner, and score placeholder |
| `accounts` | tenant | Shared customer or company records |
| `contacts` | tenant | Stakeholder records linked to accounts |
| `opportunities` | tenant | Revenue pipeline records linked to accounts, contacts, ownership, and configurable stages |
| `opportunity_stakeholders` | tenant | Buying-committee and stakeholder linkage rows attached to opportunities |
| `campaigns` | tenant | Campaign strategy, ownership, channel, budget, and related asset references |
| `campaign_members` | tenant | Lead, contact, and account membership records attached to campaigns |
| `social_posts` | tenant | Social post planning, scheduling, approval, ownership, and campaign linkage |
| `social_post_channels` | tenant | Tenant-scoped channel selections attached to social posts |
| `crm_notes` | tenant | Shared notes attached to supported CRM record types |
| `crm_activities` | tenant | Shared activities attached to supported CRM record types |
| `crm_tasks` | tenant | Shared work items attached to supported CRM record types |
| `crm_timeline_events` | tenant | Foundation table for non-task, non-note, non-activity timeline events |
| `schema_migrations` | global | Migration execution ledger |
| `seed_runs` | global | Seed execution ledger |

## Core CRM Entities

### `leads`

Key columns:
- `first_name`
- `last_name`
- `company_name`
- `email`
- `phone`
- `status_option_id`
- `source_option_id`
- `score`
- `owner_id`
- `metadata`

### `accounts`

Key columns:
- `name`
- `website`
- `industry`
- `account_type_option_id`
- `health_status_option_id`
- `owner_id`
- `metadata`

### `contacts`

Key columns:
- `first_name`
- `last_name`
- `email`
- `phone`
- `linkedin_url`
- `role_option_id`
- `owner_id`
- `account_id`
- `metadata`

### `opportunities`

Key columns:
- `name`
- `account_id`
- `primary_contact_id`
- `owner_id`
- `stage_option_id`
- `source_option_id`
- `outcome_status_option_id`
- `amount`
- `probability`
- `expected_close_date`
- `competitor`
- `next_step`
- `win_loss_reason`
- `last_stage_changed_at`
- `metadata`

### `opportunity_stakeholders`

Key columns:
- `opportunity_id`
- `contact_id`
- `metadata`

### `campaigns`

Key columns:
- `name`
- `description`
- `type_option_id`
- `objective_option_id`
- `status_option_id`
- `channel_option_id`
- `target_audience`
- `budget_amount`
- `start_date`
- `end_date`
- `owner_id`
- `related_assets`
- `metadata`

### `campaign_members`

Key columns:
- `campaign_id`
- `member_entity_type`
- `member_entity_id`
- `status_option_id`
- `response_text`
- `metadata`

### `social_posts`

Key columns:
- `title`
- `caption`
- `creative_brief`
- `hashtags`
- `scheduled_at`
- `campaign_id`
- `owner_id`
- `status_option_id`
- `approval_status_option_id`
- `metadata`

### `social_post_channels`

Key columns:
- `social_post_id`
- `channel_option_id`
- `metadata`

## Business Development and Presales Tables (Phase 12)

### `bd_target_accounts`

Strategic/target accounts for business development. Key columns:
- `account_id` (optional link to `accounts`)
- `owner_id`
- `name`, `industry`, `region`
- `tier_option_id` (`bd-account-tier`), `stage_option_id` (`bd-pipeline-stage`), `partnership_type_option_id` (`bd-partnership-type`, nullable)
- `annual_revenue`, `employee_count`
- `market_opportunity_notes`, `executive_sponsor`, `next_step`
- `is_partnership`, `metadata`
- Tenant-scoped composite foreign keys on all references; soft-deleted via `deleted_at`.

### `bd_account_stakeholders`

Relationship mapping and executive engagement tracking for a target account. Key columns:
- `target_account_id`, `contact_id` (optional link to `contacts`)
- `name`, `title`
- `influence_level` (`low|medium|high|champion|blocker`), `relationship_strength` (`none|developing|engaged|strong`)
- `is_executive`, `last_engagement_at`, `engagement_notes`

### `presales_requests`

Presales intake records (demo, RFP, RFI, proposal, technical validation, PoC). Key columns:
- `opportunity_id` (optional link to `opportunities`), `account_id`, `owner_id`, `assignee_id`
- `title`, `request_type_option_id` (`presales-request-type`), `status_option_id` (`presales-request-status`)
- `priority` (`low|medium|high|urgent`), `due_date`
- `summary`, `technical_requirements`, `proposal_content`, `metadata`

### `presales_requirements`

Technical requirement mapping, RFP/RFI items, and compliance matrix rows. Key columns:
- `request_id`
- `label`, `category` (`functional|technical|security|commercial|integration|other`)
- `requirement`, `response`
- `compliance_status` (`pending|met|partial|gap|not_applicable`), `priority`, `sort_order`

## Partner Channel Tables (Phase 13)

### `partners`

Channel partner profile records. Key columns:
- `account_id` (optional link to `accounts`), `owner_id` (partner owner)
- `name`, `region`, `territory`
- `type_option_id` (`partner-type`), `tier_option_id` (`partner-tier`), `status_option_id` (`partner-status`), `onboarding_status_option_id` (`partner-onboarding-status`)
- `agreement_reference`, `agreement_start_date`, `agreement_end_date`, `agreement_notes`
- `metadata`; tenant-scoped composite FKs; soft-deleted via `deleted_at`.

### `partner_contacts`

Partner-side contacts. Key columns: `partner_id`, optional `contact_id` link, `name`, `title`, `email`, `phone`, `is_primary`.

### `partner_onboarding_tasks`

Partner onboarding checklist. Key columns: `partner_id`, `label`, `status` (`pending|in_progress|completed|blocked`), `sort_order`, `due_date`, `completed_at`, `notes`.

### `partner_deal_registrations`

Partner deal registration and partner opportunity/lead tracking. Key columns:
- `partner_id`, optional `opportunity_id`, `account_id`, and `lead_id` links
- `name`, `customer_name`, `stage_option_id` (`partner-deal-stage`)
- `amount`, `expected_close_date`, `notes`, `metadata`.

## Reseller Management Tables (Phase 14)

### `resellers`

Reseller profile records. Key columns:
- `account_id` (optional link to `accounts`), `owner_id` (reseller owner)
- `name`, `region`, `territory`, `margin_percent`
- `status_option_id` (`reseller-status`), `pricing_tier_option_id` (`reseller-pricing-tier`), `margin_profile_option_id` (`reseller-margin-profile`), `onboarding_status_option_id` (`reseller-onboarding-status`)
- `agreement_reference`, `agreement_start_date`, `agreement_end_date`, `agreement_notes`
- `metadata`; tenant-scoped composite FKs; soft-deleted via `deleted_at`.

### `reseller_contacts`

Reseller-side contacts. Key columns: `reseller_id`, optional `contact_id` link, `name`, `title`, `email`, `phone`, `is_primary`.

### `reseller_onboarding_tasks`

Reseller onboarding checklist. Key columns: `reseller_id`, `label`, `status` (`pending|in_progress|completed|blocked`), `sort_order`, `due_date`, `completed_at`, `notes`.

### `reseller_deal_registrations`

Reseller deal registration and reseller opportunity/lead tracking. Key columns:
- `reseller_id`, optional `opportunity_id`, `account_id`, and `lead_id` links
- `name`, `customer_name`, `stage_option_id` (`reseller-deal-stage`)
- `amount`, `margin_percent`, `expected_close_date`, `notes`, `metadata`.

## Support Ticketing Tables (Phase 15)

### `support_sla_policies`

SLA policy configuration. Key columns: `name`, optional `priority_option_id` (`support-ticket-priority`), `first_response_minutes`, `resolution_minutes`, `is_active`.

### `support_tickets`

Support tickets. Key columns:
- `account_id`, `contact_id`, `customer_success_account_id` (optional links), `owner_id`, `assignee_id`, `sla_policy_id`
- `subject`, `description`
- `status_option_id` (`support-ticket-status`), `priority_option_id` (`support-ticket-priority`), `category_option_id` (`support-ticket-category`), `source_option_id` (`support-ticket-source`)
- `escalation_status` (`none|pending|escalated|resolved`), `root_cause`, `resolution_notes`
- SLA tracking: `first_response_due_at`, `resolution_due_at`, `first_response_at`, `resolved_at` (breach is computed from these at read time)
- `metadata`; tenant-scoped composite FKs; soft-deleted via `deleted_at`.

### `support_ticket_messages`

Internal notes and customer-visible replies. Key columns: `ticket_id`, `author_id`, `message_type` (`internal_note|customer_reply`), `body`.

### `support_knowledge_articles`

Knowledge base articles. Key columns: `title`, optional `category_option_id` (`support-knowledge-category`), `summary`, `body`, `status` (`draft|published|archived`).

### `support_ticket_articles`

Junction linking knowledge articles to tickets. Key columns: `ticket_id`, `article_id` (unique active per ticket/article pair).

## Customer Success Tables (Phase 16)

### `customer_success_accounts`

Central customer success record per account. Key columns:
- `account_id` (link to `accounts`), `csm_owner_id`
- `segment_option_id` (`cs-segment`), `lifecycle_stage_option_id` (`customer-success-stage`), `risk_status_option_id` (`cs-risk-status`), `expansion_potential_option_id` (`cs-expansion-potential`)
- `health_score`, `adoption_score` (0–100), `renewal_date`, `contract_value`
- `support_trend` (`improving|stable|declining`), `training_status` (`not_started|in_progress|completed`)
- `last_touchpoint_at`, `next_action`; tenant-scoped composite FKs; soft-deleted.

### `onboarding_plans` / `onboarding_milestones`

Onboarding plan per CS account (`status`, `start_date`, `target_go_live_date`, `product_activation_status`, `first_value_at`, `training_completion`, `risk_notes`, `handover_notes`) and its ordered milestones (`label`, `status`, `sort_order`, `due_date`, `completed_at`, `notes`).

### `success_plans`

Strategic/enterprise plans: `name`, `status`, `objective`, `value_realization`, `executive_sponsor`, `stakeholders` (JSONB stakeholder map), `expansion_opportunities`, `renewal_strategy`.

### `customer_health_scores`

Health score history: `score` (0–100), optional `risk_status_option_id`, `drivers`, `notes`, `recorded_at`.

### `adoption_metrics`

Adoption tracking: `metric_key`, `label`, `value`, `target`, `unit`, `trend` (`up|flat|down`), `period_start`, `period_end`.

### `qbrs`

QBR/EBR records: `title`, `qbr_type` (`qbr|ebr`), `status` (`scheduled|completed|cancelled`), `scheduled_at`, `summary`, `outcomes`, `next_steps`, `owner_id`.

### `renewals`

Renewal tracking: `renewal_date`, `status_option_id` (`cs-renewal-status`), `contract_value`, `forecast_value`, `probability`, `risk_notes`, `strategy`, `owner_id`.

### `escalations`

Risk register: `title`, `severity` (`low|medium|high|critical`), `status` (`open|in_progress|resolved|closed`), `description`, `resolution`, `opened_at`, `resolved_at`, `owner_id`.

## Customer Training Tables (Phase 17)

### `training_programs`

Top-level training programs: `title`, `description`, `status` (`draft|published|archived`), `category_option_id` (`training-category`), `level_option_id` (`training-level`), `owner_id`, `estimated_minutes`, `is_role_based`, `target_role`.

### `training_modules` / `training_lessons` / `training_assets`

Modules group lessons within a program (`title`, `sort_order`). Lessons (`title`, `content`, `lesson_type` `article|video|quiz|interactive`, `duration_minutes`, `sort_order`) belong to a module and carry a denormalized `program_id`. Assets (`name`, `asset_type` `link|video|document|scorm`, `url`, `external_reference`) attach to a lesson (upload/link placeholder).

### `customer_learners`

Learner records: `learner_type` (`user|contact`), optional `user_id`/`contact_id`/`account_id`, `display_name`, `email`.

### `training_assignments`

Assigns a program to a `user`, `contact`, or `account`, optionally linked to a `cs_account_id` (customer success account) and `onboarding_plan_id`. Tracks `status` (`assigned|in_progress|completed|expired`), `completion_percent`, `due_date`, `completed_at`.

### `training_progress`

Per-assignment, per-lesson progress: `status` (`not_started|in_progress|completed`), `progress_percent`, `started_at`, `completed_at` (unique active per assignment/lesson). Updating progress recomputes the assignment's completion and status.

### `training_feedback`

Feedback on a program/lesson/assignment: `rating` (1–5), `comments`.

### `training_certifications`

Certification placeholder: `program_id`, `learner_id`, `status` (`not_started|in_progress|earned|expired`), `earned_at`, `expires_at`, `certificate_reference`.

## Shared Productivity Tables

### `crm_notes`

Key columns:
- `tenant_id`
- `entity_type`
- `entity_id`
- `author_user_id`
- `body`
- `is_customer_facing`
- `metadata`
- `created_at`
- `updated_at`
- `deleted_at`

Supported `entity_type` values:
- `lead`
- `account`
- `contact`
- `campaign`
- `opportunity`
- `ticket`
- `customer_success_account`

### `crm_activities`

Key columns:
- `tenant_id`
- `entity_type`
- `entity_id`
- `activity_type`
- `subject`
- `description`
- `outcome`
- `occurred_at`
- `owner_user_id`
- `author_user_id`
- `metadata`
- `created_at`
- `updated_at`
- `deleted_at`

Supported `activity_type` values:
- `call`
- `email`
- `meeting`
- `chat`
- `social`
- `demo`
- `training`
- `support`
- `renewal`
- `task`
- `status_change`
- `note`

### `crm_tasks`

Key columns:
- `tenant_id`
- `entity_type`
- `entity_id`
- `owner_user_id`
- `assignee_user_id`
- `title`
- `description`
- `due_at`
- `reminder_at`
- `priority`
- `status`
- `metadata`
- `created_at`
- `updated_at`
- `deleted_at`

Supported `priority` values:
- `low`
- `medium`
- `high`
- `urgent`

Supported `status` values:
- `open`
- `in_progress`
- `blocked`
- `completed`
- `cancelled`

### `crm_timeline_events`

Key columns:
- `tenant_id`
- `entity_type`
- `entity_id`
- `touchpoint_type`
- `title`
- `description`
- `occurred_at`
- `owner_user_id`
- `metadata`
- `created_at`
- `updated_at`
- `deleted_at`

Supported `touchpoint_type` values:
- `ticket`
- `campaign`
- `training`
- `onboarding_milestone`

## Relationship Summary

- a `lead` belongs to one tenant and may be owned by one tenant user
- an `account` belongs to one tenant and may be owned by one tenant user
- a `contact` belongs to one tenant, may be owned by one tenant user, and may belong to one tenant account
- a `campaign` belongs to one tenant, may be owned by one tenant user, and stores configurable type, objective, status, and channel option references
- a `campaign_member` belongs to one tenant campaign and points to one tenant lead, contact, or account through a typed polymorphic reference
- a `social_post` belongs to one tenant, may be linked to one tenant campaign, may be owned by one tenant user, and stores configurable status and approval references
- a `social_post_channel` belongs to one tenant social post and points to one tenant-configured social channel option value
- shared productivity tables are keyed by `entity_type` plus `entity_id`
- notes, activities, tasks, and timeline events are all soft-delete-aware and tenant-scoped
- tenant option sets provide configurable dropdown values for lead, account, contact, campaign, and social fields

## Seeded Bootstrap Records

The seed now creates or updates:
- the default tenant from `DEFAULT_TENANT_SLUG` and `DEFAULT_TENANT_NAME`
- the full permission catalog
- the full role-template catalog
- seeded tenant roles derived from those templates
- the default admin user from `DEFAULT_ADMIN_*`
- a `super-admin` assignment for that user
- tenant workspace settings, theme, modules, and terminology
- seeded option sets for:
  - lead status
  - lead source
  - account type
  - account health
  - contact role
  - campaign type
  - campaign objective
  - campaign status
  - campaign channel
  - campaign member status
  - social channel
  - social post status
  - social approval status
  - opportunity pipeline
  - support ticket status
  - customer-success stage
- seeded lead, account, contact, campaign, and social form-layout metadata

## RAG Knowledge System (Phase 20)

The RAG foundation adds six tenant-scoped tables:

- `knowledge_sources` — corpus categories with `source_type`, `access_scope` (`tenant`/`restricted`), an optional `required_permission` retrieval gate, `is_enabled`, and `is_system`. Unique per `(tenant_id, source_key)`; nine baseline sources are seeded per tenant.
- `knowledge_documents` — ingested text under a source (composite FK `(source_id, tenant_id)`), with `content`, `content_format`, `source_uri`, `status` (`pending`/`chunked`/`embedded`), and chunk/token counts.
- `knowledge_chunks` — chunked content (composite FK to documents), with `chunk_index`, `embedding_status` (`pending`/`placeholder`/`embedded`), `embedding_model`, and an `embedding_ref` vector-storage placeholder. A GIN `to_tsvector` index supports text retrieval.
- `knowledge_articles` + `knowledge_article_versions` — versioned, approval-gated articles mirroring the prompt/article versioning pattern (`status`, `is_published`, `current_version`/`latest_version`; immutable version snapshots).
- `knowledge_gaps` — queries that returned no retrieval results (`detected_source`, `status`, `occurrence_count`).

All knowledge tables follow the standard `created_at`/`updated_at`/`deleted_at` and `created_by`/`updated_by` conventions (versions and chunks are append-only) and use composite `(id, tenant_id)` uniqueness for tenant-safe foreign keys.

## Current Limits

- dedicated `tickets` and `customer_success_accounts` primary tables are still a later phase
- shared productivity tables already accept those entity types to avoid schema rewrites later
- campaign performance metrics, attribution, and true calendar scheduling remain placeholders on top of the now-live campaign schema
- social publishing, engagement ingestion, lead capture, listening, and competitor benchmarking remain placeholders on top of the now-live social planning schema
