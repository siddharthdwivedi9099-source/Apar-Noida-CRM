# Access Control Guide

## Purpose

This guide explains the implemented authentication and authorization controls that currently exist in code.

## Current Access-Control Layers

### Authentication

- users sign in with `tenantSlug`, email, and password
- the backend issues a JWT access token plus an HTTP-only refresh token
- protected API routes require a valid access token and an active database-backed session
- refresh rotation, logout, failed-login tracking, and login rate limiting are enabled

### Authorization Data Model

The current RBAC schema uses:
- `roles`
- `permissions`
- `role_permissions`
- `user_roles`
- `role_templates`
- `role_template_permissions`

Current model:
- permissions are global catalog entries
- roles are tenant-scoped
- users receive roles within a tenant
- role templates provide seeded starting bundles
- role permissions and user-role assignments are soft-delete-aware

### Request Authorization Context

When an authenticated request reaches the API:
- the access token is validated
- the session is validated
- the current user roles are resolved
- the current permission codes are resolved
- permission middleware can then allow or block the request

### API Enforcement

The API now enforces permissions on the RBAC management surface:
- `GET /rbac/catalog` requires administrative view access
- role creation requires `admin.create` or `admin.configure`
- role updates require `admin.edit` or `admin.configure`
- role deletion requires `admin.delete` or `admin.configure`
- role-permission assignment requires `admin.assign` or `admin.configure`
- user-role assignment requires `admin.assign` or `admin.configure`

### Frontend Enforcement

The web app now:
- restores the current session during startup
- redirects unauthenticated users to `/login`
- hides sidebar modules when the current user lacks access to that module
- blocks protected module routes with an access-denied state when visited manually
- exposes the active permission set through the auth provider

## Seeded Access Baseline

The core seed now creates or updates:
- the default tenant
- the full Phase 4 permission catalog
- global role templates
- the default tenant role set derived from those templates
- the default admin user
- a `super-admin` assignment for that user

If a legacy bootstrap `tenant-admin` role exists from earlier phases, the seed migrates it into `super-admin` when possible.

## Permission Philosophy

Implemented today:
- configurable roles
- role templates
- permission catalog
- permission middleware
- permission-aware navigation
- permission-aware route rendering
- tenant-scoped user-role assignment

Still future work:
- record-level ownership checks
- field-level redaction
- domain-specific approval policies
- richer user lifecycle administration beyond seeded users

## AI Access Control (Phase 18)

The AI Gateway enforces access control on every AI surface:

- **Execution** — `POST /ai/gateway/execute` requires `ai.use_ai` (or `ai.manage_ai`/`ai.configure`). Requests are denied and logged when AI is disabled for the tenant.
- **Configuration** — `PATCH /ai/settings` requires `ai.configure` or `ai.manage_ai`. Read access to settings, providers, and templates requires any `ai.*` permission.
- **Logs and usage** — `GET /ai/logs` and `GET /ai/usage` require `ai.view`, `ai.view_dashboard`, `ai.manage_ai`, or `ai.configure`.
- **Provider/model overrides** — rejected unless the tenant enables `allow_user_overrides`.
- **Tenant isolation** — AI settings and `ai_usage_logs` are tenant-scoped; cross-tenant access is not possible.
- **Auditability** — gateway executions and settings changes are written to the audit log; all requests are written to `ai_usage_logs`.

See [../ai/AI_GOVERNANCE.md](../ai/AI_GOVERNANCE.md) for the full governance model.

## Relationship to the RBAC Matrix

[RBAC_MATRIX.md](./RBAC_MATRIX.md) now reflects the actual seeded modules, action categories, and role templates rather than a planning-only access sketch.
