# Data Model

## Purpose

This document describes the implemented database model after Phase 7.

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
- shared productivity tables are keyed by `entity_type` plus `entity_id`
- notes, activities, tasks, and timeline events are all soft-delete-aware and tenant-scoped
- tenant option sets provide configurable dropdown values for lead, account, and contact fields

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
  - opportunity pipeline
  - support ticket status
  - customer-success stage
- seeded lead, account, and contact form-layout metadata

## Current Limits

- dedicated `opportunities`, `tickets`, and `customer_success_accounts` primary tables are still a later phase
- shared productivity tables already accept those entity types to avoid schema rewrites later
- timeline foundation for campaigns, training, onboarding, and ticket touchpoints exists, but those modules have not yet started writing live events
