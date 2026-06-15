# Data Model

## Purpose

This document describes the implemented Phase 2 foundation schema that now backs authentication, tenancy, and administrative bootstrapping.

## Implemented Foundation Scope

The current database baseline covers:
- tenant identity and isolation
- tenant-scoped users, teams, departments, and roles
- global permission catalog with tenant role assignment
- audit logging
- system settings
- refresh-token-backed auth sessions
- migration and seed tracking tables

It does not yet cover CRM business entities such as accounts, contacts, leads, or opportunities.

## Modeling Standards

### Tenant Scope

- tenant-owned tables carry `tenant_id`
- tenant consistency is enforced on key joins through composite foreign keys where practical
- `permissions` remain global so the catalog can be reused across tenants

### Timestamps

The standard mutable-table fields are:
- `created_at`
- `updated_at`
- `deleted_at`

`updated_at` is maintained by a shared trigger in the initial migration.

### Actor Tracking

Where applicable, mutable tables also include:
- `created_by`
- `updated_by`
- `owner_id`

These are intentionally soft references today so bootstrap flows and audit retention are not blocked by circular dependencies.

### Metadata

Extensible tables include a `metadata JSONB NOT NULL DEFAULT '{}'::jsonb` column for future product-specific expansion without repeated schema churn.

### Soft Delete Pattern

The current pattern is:
- mark records with `deleted_at`
- keep operational queries filtered to `deleted_at IS NULL`
- preserve audit history instead of hard deleting by default

Current exception:
- `audit_logs` is append-only and intentionally does not support soft delete

## Implemented Tables

| Table | Scope | Purpose | Notes |
| --- | --- | --- | --- |
| `tenants` | global | Primary logical isolation boundary | Includes `slug`, status, owner, metadata, timestamps |
| `users` | tenant | Login identity and future operator profile | Includes password hash, lockout fields, team/department refs |
| `teams` | tenant | Operational grouping for ownership and reporting | Optional department relationship |
| `departments` | tenant | Organizational hierarchy | Supports parent department |
| `roles` | tenant | Reusable authorization bundles | Seeded with `tenant-admin` |
| `permissions` | global | Canonical permission catalog | Seeded catalog reused across tenants |
| `role_permissions` | tenant | Role-to-permission assignment | Carries tenant context explicitly |
| `user_roles` | tenant | User-to-role assignment | Supports future expiry via `expires_at` |
| `auth_sessions` | tenant | Refresh token storage and session tracking | Stores hashed refresh token, expiry, revoke state |
| `audit_logs` | tenant or global | Immutable security and admin trail | Used for login, logout, refresh, and failed-login events |
| `system_settings` | tenant or global | JSONB-backed configuration storage | Supports tenant overrides and future platform defaults |
| `schema_migrations` | global | Migration execution ledger | Managed by the migration runner |
| `seed_runs` | global | Seed execution ledger | Managed by the seed runner |

## Auth and Access Relationships

- each `user` belongs to one tenant in the current foundation
- each `role` belongs to one tenant
- `permissions` are global catalog entries
- `user_roles` grants tenant-scoped roles to users
- `role_permissions` grants global permissions to tenant roles
- `auth_sessions` belongs to a tenant user and tracks refresh token rotation
- `audit_logs` may reference a tenant, actor user, and session when known

## Seeded Bootstrap Records

The core seed currently creates or updates:
- the default tenant from `DEFAULT_TENANT_SLUG` and `DEFAULT_TENANT_NAME`
- the `tenant-admin` role
- the global permission catalog
- the default admin user from `DEFAULT_ADMIN_*`
- the admin role assignment and bootstrap system setting

## Current Limits

- cross-tenant user membership is not implemented yet
- platform-level admin impersonation flows are not implemented yet
- record-level and field-level authorization are not implemented yet
- CRM domain entities will arrive in later migrations
