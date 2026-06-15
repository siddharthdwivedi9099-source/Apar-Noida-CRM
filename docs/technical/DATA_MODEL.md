# Data Model

## Purpose

This document describes the current implemented schema after Phase 2, Phase 3, and Phase 4 foundation work.

## Implemented Scope

The database baseline now covers:
- tenant identity and isolation
- tenant-scoped users, teams, departments, and roles
- global permission catalog
- global role templates
- tenant role-permission assignment
- tenant user-role assignment
- authentication sessions
- audit logging
- system settings
- migration and seed tracking

It does not yet cover CRM business entities such as accounts, contacts, leads, or opportunities.

## Modeling Standards

### Tenant Scope

- tenant-owned tables carry `tenant_id`
- tenant consistency is enforced on key joins through composite foreign keys where practical
- `permissions` and `role_templates` remain global so the vocabulary and starting bundles are reusable across tenants

### Timestamps

The standard mutable-table fields are:
- `created_at`
- `updated_at`
- `deleted_at`

`updated_at` is maintained by shared triggers.

### Actor Tracking

Where applicable, mutable tables also include:
- `created_by`
- `updated_by`
- `owner_id`

These remain soft references so bootstrap flows and audit retention are not blocked by circular dependencies.

### Metadata

Extensible tables include `metadata JSONB NOT NULL DEFAULT '{}'::jsonb` for future tenant- or product-specific expansion without repeated schema churn.

### Soft Delete Pattern

The current pattern is:
- mark records with `deleted_at`
- keep operational queries filtered to `deleted_at IS NULL`
- preserve history instead of hard deleting by default

`audit_logs` remains append-only and intentionally does not use soft delete.

## Implemented Tables

| Table | Scope | Purpose | Notes |
| --- | --- | --- | --- |
| `tenants` | global | Primary logical isolation boundary | Includes `slug`, status, owner, metadata, timestamps |
| `users` | tenant | Login identity and future operator profile | Includes password hash, lockout fields, team and department refs |
| `teams` | tenant | Operational grouping for ownership and reporting | Optional department relationship |
| `departments` | tenant | Organizational hierarchy | Supports parent department |
| `roles` | tenant | Reusable authorization bundles | Seeded from role templates; includes system-role flag |
| `permissions` | global | Canonical permission catalog | Seeded with module and action permission matrix |
| `role_permissions` | tenant | Role-to-permission assignment | Carries tenant context explicitly |
| `user_roles` | tenant | User-to-role assignment | Supports future expiry via `expires_at` |
| `role_templates` | global | Seeded role blueprint catalog | Provides default tenant role starting points |
| `role_template_permissions` | global | Template-to-permission assignment | Drives seeded role template bundles |
| `auth_sessions` | tenant | Refresh token storage and session tracking | Stores hashed refresh token, expiry, revoke state |
| `audit_logs` | tenant or global | Immutable security and admin trail | Used for auth and RBAC lifecycle events |
| `system_settings` | tenant or global | JSONB-backed configuration storage | Supports tenant overrides and bootstrap metadata |
| `schema_migrations` | global | Migration execution ledger | Managed by the migration runner |
| `seed_runs` | global | Seed execution ledger | Managed by the seed runner |

## Auth and Access Relationships

- each `user` belongs to one tenant in the current foundation
- each `role` belongs to one tenant
- `permissions` are global catalog entries
- `role_templates` are global seeded blueprints
- `role_template_permissions` grant permissions to templates
- `role_permissions` grant global permissions to tenant roles
- `user_roles` grants tenant-scoped roles to users
- `auth_sessions` belongs to a tenant user and tracks refresh token rotation
- `audit_logs` may reference a tenant, actor user, and session when known

## Seeded Bootstrap Records

The core seed currently creates or updates:
- the default tenant from `DEFAULT_TENANT_SLUG` and `DEFAULT_TENANT_NAME`
- the full Phase 4 permission catalog
- the full seeded role template catalog
- seeded tenant roles derived from those templates
- the default admin user from `DEFAULT_ADMIN_*`
- a `super-admin` assignment for that user
- tenant bootstrap metadata in `system_settings`

If a legacy `tenant-admin` role exists from an earlier foundation seed, the seed migrates it into `super-admin` when possible.

## Current Limits

- cross-tenant user membership is not implemented yet
- platform-level impersonation flows are not implemented yet
- record-level and field-level authorization are not implemented yet
- CRM business entities will arrive in later migrations
