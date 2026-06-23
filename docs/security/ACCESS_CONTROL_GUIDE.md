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

## Customer Portal Access Control (Phase 26)

Phase 26 adds a dedicated `customer_portal` RBAC module and seeded **Customer Portal User** role.

- **Profile gate** — a user must have an active `customer_portal_profiles` row linked to one tenant account before any `/customer-portal/*` API returns data.
- **Tenant boundary** — every portal query filters by `tenant_id`.
- **Account boundary** — tickets are filtered by the portal profile's `account_id`; portal ticket creation ignores caller-supplied account IDs and uses the profile account.
- **Contact/user boundary** — training is visible when assigned to the current user, profile contact, profile account, or a matching customer learner.
- **Internal data redaction** — customer ticket responses omit owner, assignee, root cause, internal notes, and internal resolution fields.
- **Customer-safe AI** — portal Ask AI only retrieves approved/published articles from enabled tenant-scoped knowledge sources with no internal `required_permission`.
- **Frontend separation** — `/portal/*` uses a separate customer portal shell; customer-only users do not see the internal CRM sidebar.

## Audit, Security and Data Governance (Phase 27)

Phase 27 centralizes the audit trail and adds an administrative governance surface under `/audit`, gated by the `admin` permission module.

- **Read gate** — `/audit/logs`, `/audit/summary`, `/audit/security-review`, and `GET /audit/governance` accept any of `admin.view`, `admin.view_dashboard`, `admin.configure`, or `admin.manage_workflow`.
- **Export gate** — `/audit/export` requires `admin.export` or `admin.configure`; every export is itself written to the audit log as a `security` / `audit.export` event.
- **Configure gate** — `PATCH /audit/governance` requires `admin.configure` and records a `security` / `data_governance.update` event listing the changed fields.
- **Tenant boundary** — every audit query and governance row is filtered by `tenant_id`; the governance row is provisioned with configured defaults on first read.
- **Failed-access logging** — authenticated requests that resolve to `401`/`403` are written to the audit log as `security` / `security.access_denied` events by a database-aware error handler. Logging is best-effort and never blocks or fails the response.
- **Rate limiting** — a global in-memory per-client limiter protects the whole API (keyed by authenticated user, else client IP), and `GET /audit/security/rate-limit-check` provides a strict per-user probe that returns `429 RATE_LIMITED` past its limit.
- **Transport hardening** — strengthened Helmet headers (`no-referrer`, same-site CORP, production HSTS), an explicit CORS method allowlist with preflight caching, and `trust proxy` for correct forwarded client-IP resolution.

## Relationship to the RBAC Matrix

[RBAC_MATRIX.md](./RBAC_MATRIX.md) now reflects the actual seeded modules, action categories, and role templates rather than a planning-only access sketch.

## Authorization Enforcement Points (2026-06-23 review)

Authorization is enforced at two complementary layers, both verified during the security review:
- **Router layer** — every data router applies the authentication middleware; only the public `health` router is unauthenticated by design. Most routers then gate handlers with permission requirements.
- **Service layer** — some modules (e.g. dashboards) intentionally allow any authenticated user to reach the catalog endpoint and enforce per-resource permissions inside the service via `requirePermission(...)`, including record-ownership checks (e.g. a user may only modify their own saved views). This is defense-in-depth, not a missing check.

Customer-portal access is additionally constrained to the caller's own `tenant_id`, `user_id`, and `account_id`, and requires an active portal profile before any portal data is returned.

See [SECURITY_REVIEW_REPORT.md](./SECURITY_REVIEW_REPORT.md) for the full area-by-area assessment.
