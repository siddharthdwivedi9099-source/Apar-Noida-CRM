# Technical Design

## Purpose

This document describes the implemented technical baseline through Phase 5 and explains how tenant-aware configuration is now wired across the database, API, and frontend shell.

## Implemented Scope

The current repository now includes:
- Phase 1 runtime foundation
- Phase 2 PostgreSQL integration, migrations, and seeds
- Phase 3 authentication, sessions, and protected routing
- Phase 4 RBAC, permission middleware, and role management
- Phase 5 tenant configuration, theme management, module switches, terminology, and custom-field metadata foundations

## Current Architecture

### Frontend

The web app is built with:
- React 18
- TypeScript
- Vite
- React Router
- Tailwind CSS

Implemented frontend layers:
- `AuthProvider` for login state, bootstrap refresh, and permission helpers
- `TenantConfigProvider` for tenant settings bootstrap, terminology lookup, module gating, and live theme application
- protected routes plus permission-aware route wrappers
- admin settings routes for workspace settings, theme, modules, terminology, custom fields, and RBAC

### Backend

The API is built with:
- Node.js
- Express
- TypeScript
- Zod
- PostgreSQL via `pg`

Implemented backend modules:
- `auth`
- `rbac`
- `tenant-config`
- `health`

Cross-cutting middleware already in use:
- request context and request IDs
- structured request logging
- centralized validation
- JWT authentication
- permission middleware
- centralized error handling

### Shared Packages

#### `@crm/types`

Holds:
- auth contracts
- RBAC contracts
- tenant configuration contracts
- option-set and custom-field metadata types

#### `@crm/config`

Holds:
- platform metadata
- API version metadata
- shared environment guidance

#### `@crm/database`

Holds:
- PostgreSQL pool wrapper
- migration runner
- rollback/status helpers
- idempotent seed runner

## Tenant Configuration Design

### Configuration Domains

Phase 5 introduces tenant-scoped configuration in these domains:
- workspace settings
- theme settings
- module enablement
- terminology overrides
- configurable option sets
- custom field metadata
- custom form layout metadata

### Persistence Strategy

Two persistence patterns are used:

#### `system_settings`

Used for document-style tenant settings:
- `tenant.settings`
- `tenant.theme`
- `tenant.modules`
- `tenant.terminology`
- `tenant.bootstrap`

This keeps simple tenant settings flexible and easy to version forward.

#### Dedicated metadata tables

Used for structured tenant configuration:
- `tenant_option_sets`
- `tenant_option_values`
- `custom_field_definitions`
- `custom_form_layouts`

This supports CRUD, auditability, soft delete, and future joins from CRM business tables.

## Database Conventions

New Phase 5 tables follow the same baseline conventions established earlier:
- `tenant_id` on tenant-owned records
- `created_at`, `updated_at`, `deleted_at`
- `created_by`, `updated_by`, `owner_id` where applicable
- `metadata JSONB` for extensibility
- soft delete instead of destructive removal
- `set_row_updated_at()` trigger-driven `updated_at` maintenance

## API Design

### Route Group

Tenant configuration APIs are exposed under:

```text
/api/v1/tenant-config
```

### Endpoint Structure

Implemented endpoint groups:
- workspace bootstrap summary
- tenant settings read/update
- theme read/update
- module settings read/update
- terminology read/update
- custom field list/create/update/delete
- option-set list/replace
- form-layout list

### Authorization Model

Tenant configuration routes rely on existing admin RBAC permissions:
- reads require `admin.view` or `admin.configure`
- writes require `admin.edit`, `admin.create`, `admin.delete`, or `admin.configure` depending on the operation

### Audit Model

Configuration writes emit `tenant_config` audit events with:
- tenant ID
- actor user ID
- session ID
- request ID
- IP and user agent
- action-specific metadata

## Frontend Configuration Application

### Tenant Bootstrap Flow

After auth completes:
1. the web app requests `GET /api/v1/tenant-config`
2. tenant settings are cached in `TenantConfigProvider`
3. theme tokens are applied to `document.documentElement`
4. module switches and terminology become available to routing and navigation

### Theme Application

The frontend applies tenant theme settings by:
- setting CSS custom properties for `primary`, `secondary`, `accent`, and `ring`
- switching light/dark mode through the root `dark` class
- setting root `data-*` attributes for sidebar style, card style, density, and font preference
- updating hero glow colors and font families through CSS variables

### Module Gating

Module visibility now depends on both:
- RBAC permission codes
- tenant module enablement

That means a route is only open when:
- the user has permission
- the tenant has not disabled the module

### Terminology Propagation

Terminology overrides are currently reflected in:
- sidebar labels
- topbar labels
- placeholder module page titles and summaries

This keeps the naming foundation live before full CRUD modules arrive.

## Seed Design

The seed runner now bootstraps:
- default tenant
- admin user
- permission catalog
- role templates and tenant roles
- workspace settings
- theme defaults
- module enablement map
- terminology defaults
- seeded option sets
- seeded custom form layouts

The seed remains idempotent and updates existing seeded records instead of duplicating them.

## Observability and Performance (Phase 29)

Operational visibility and performance readiness are first-class concerns:

- **Structured logging.** A pino JSON logger carries `service`/`environment` base
  fields and redacts secrets. Request, error, slow-query, AI-usage, and
  workflow-execution logs are all structured; every request gets a correlatable
  `x-request-id`.
- **Operational endpoints.** Liveness (`/health`, `/live`), readiness (`/ready`,
  `503` when dependencies are unreachable), and a placeholder metrics endpoint
  (`/metrics`, process + cache counters) are unauthenticated for probes/scrapers.
  Admin-gated `/observability/jobs` and `/observability/cache` expose the
  background-job catalog and cache status.
- **Slow-query logging.** `DatabaseService` times statements (direct and pooled)
  and logs any exceeding `SLOW_QUERY_THRESHOLD_MS`.
- **Indexing.** Tenant-scoped partial indexes (`WHERE deleted_at IS NULL`) cover
  filter and sort paths; Phase 29 adds composites for email/name/score/schedule
  and SLA scanning. See the [Performance Guide](../deployment/PERFORMANCE_GUIDE.md).
- **Pagination.** List endpoints use bounded offset pagination with capped page
  sizes and indexed sort columns; keyset pagination is the future enhancement.
- **Dashboard caching.** Dashboard metrics route through a tenant-scoped cache
  seam (`CacheService`) with TTL and hit/miss accounting; Redis-backed serving is
  deferred (placeholder), so it currently recomputes live.
- **Background jobs.** A job monitor publishes the planned background-job catalog
  (retention purge, embedding backfill, workflow scheduler, notification
  dispatch, cache warmer); a worker runtime is deferred to the cache/queue phase.

See the [Observability Guide](../deployment/OBSERVABILITY_GUIDE.md) for endpoint
and logging details.

## Current Limits

Phase 5 intentionally does not yet implement:
- public self-signup
- tenant-created user lifecycle UI
- record-level authorization
- business-module CRUD
- form-rendering from custom layout metadata
- dynamic runtime rendering of custom fields inside CRM entity forms

## Shared API Utilities (2026-06-23 code review)

To remove duplication that had accumulated across the 25+ module routers and services, common helpers now live in dedicated modules under `apps/api/src/common/`:
- `common/http/request-metadata.ts` — `getClientIp` / `getAuditMetadata` for audit logging (used by every router).
- `common/pagination.ts` — `buildPagination` / `getPositiveNumber` for list endpoints (used by every paginated service).

Each module imports these rather than redefining them locally. The rate limiter retains its own `getClientIp` variant because it deliberately falls back to `request.socket.remoteAddress` for keying.

Configuration safety is enforced centrally in `common`-adjacent `config/env.ts`: in production the process refuses to start with development JWT secrets, a default admin password, or a non-`Secure` refresh cookie. See [../security/SECURITY_DESIGN.md](../security/SECURITY_DESIGN.md) and [../security/SECURITY_REVIEW_REPORT.md](../security/SECURITY_REVIEW_REPORT.md).

## Next Technical Steps

The next implementation phase should:
- introduce tenant-aware CRM core tables for leads, accounts, and contacts
- consume tenant option sets and terminology in those modules
- read custom-field metadata during form rendering
- preserve audit logging and RBAC checks for business CRUD
- reconcile the `getPagination`/`buildPagination` empty-result semantics into a single shared helper
