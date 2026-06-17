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

## Current Limits

- dedicated `tickets` and `customer_success_accounts` primary tables are still a later phase
- shared productivity tables already accept those entity types to avoid schema rewrites later
- campaign performance metrics, attribution, and true calendar scheduling remain placeholders on top of the now-live campaign schema
- social publishing, engagement ingestion, lead capture, listening, and competitor benchmarking remain placeholders on top of the now-live social planning schema
