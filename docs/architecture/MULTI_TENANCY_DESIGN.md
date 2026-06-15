# Multi-Tenancy Design

## Current Implementation

The platform now starts with logical multi-tenancy on shared PostgreSQL infrastructure.

The implemented model is:
- one `tenants` table as the primary isolation boundary
- tenant-owned records carry `tenant_id`
- tenant-specific role assignment tables also carry `tenant_id`
- authentication requires tenant context through `tenantSlug + email + password`

## Isolation Strategy

### Database Layer

Tenant scope is applied directly in the schema for:
- `users`
- `teams`
- `departments`
- `roles`
- `role_permissions`
- `user_roles`
- `auth_sessions`
- tenant-scoped `system_settings`
- tenant-scoped `audit_logs`

Composite foreign keys are used where helpful to reduce accidental cross-tenant joins between related records.

### Identity Layer

The current identity model is tenant-first:
- a user belongs to one tenant in the current foundation
- login resolves tenant context from `tenantSlug`
- JWT access tokens carry `tenantId`
- refresh sessions are stored with both `tenant_id` and `user_id`

### Authorization Layer

The current authorization foundation is:
- global permission catalog
- tenant roles
- tenant user-role assignments
- tenant role-permission assignments

This keeps the permission vocabulary stable while allowing tenant-local role composition.

## Shared vs Tenant-Scoped Data

### Shared Today

- `permissions`
- `schema_migrations`
- `seed_runs`

### Tenant-Scoped Today

- `users`
- `teams`
- `departments`
- `roles`
- `role_permissions`
- `user_roles`
- `auth_sessions`

### Hybrid Today

- `audit_logs`
- `system_settings`

These can be global or tenant-specific depending on the use case.

## Runtime Boundary Rules

Current runtime rules:
- protected API routes require a valid access token
- access token verification confirms the backing session is still active
- the frontend redirects unauthenticated users to `/login`
- current-user loading is tenant-aware through `/api/v1/auth/me`

## Current Limits

- cross-tenant memberships are not implemented yet
- tenant resolution from subdomain or custom domain is not implemented yet
- row-level security policies are not enabled yet
- platform-operator cross-tenant tooling is not implemented yet

## Next Multi-Tenancy Steps

Future phases should add:
- explicit tenant context propagation across jobs and automation
- tenant-aware business domain tables
- cross-tenant operator controls with stronger audit coverage
- optional higher-isolation strategies for regulated tenants
