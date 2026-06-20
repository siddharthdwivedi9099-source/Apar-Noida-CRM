# AI-Native CRM Platform

## Current State

This repository now contains the implemented foundation for:
- Phase 1: web and API initialization
- Phase 2: PostgreSQL integration, migrations, seeds, and base schema
- Phase 3: authentication, session handling, and protected frontend routing
- Phase 4: RBAC, role templates, permission middleware, and admin role management
- Phase 5: tenant settings, theme configuration, module switches, terminology, and custom-field metadata foundations
- Phase 6: leads, accounts, and contacts CRM foundation
- Phase 7: activities, tasks, notes, and customer timeline
- Phase 8: campaign management and marketing foundation
- Phase 9: social media marketing module
- Phase 10: sales pipeline and opportunity management
- Phase 11: SDR and inside sales workspace
- Phases 12–27: business development, partners, resellers, support, customer success, training, the AI platform (gateway, registries, RAG, customer query bot, module AI actions), dashboards, workflow automation, notifications and approvals, the customer portal, and audit/security/data-governance
- Phase 28: automated testing framework (Vitest) with backend, frontend, and contract test coverage
- Phase 29: observability, logging, metrics placeholders, cache seams, background-job monitor, and performance indexes
- Phase 30: deployment, DevOps, Docker, and CI readiness

## What Exists Now

### Frontend

- React + TypeScript + Vite
- protected routing with current-user loading
- auth state provider and logout flow
- permission-aware navigation
- tenant-config bootstrap provider
- admin settings pages for workspace, theme, modules, terminology, and custom fields
- RBAC management workspace
- live theme reflection from tenant settings
- module-aware route blocking for disabled modules
- live leads, accounts, and contacts list/detail/form flows
- live opportunity list/detail/form flows with dashboard metrics and Kanban stage movement
- dedicated SDR and inside-sales workspace routes with qualification, handoff, and queue management
- notes, activities, tasks, and timeline experiences on CRM detail pages
- live campaigns list/detail/form flows with member management and AI placeholders

### Backend

- Express + TypeScript API
- PostgreSQL-backed health checks
- liveness, readiness, metrics, and observability/admin endpoints
- SQL migration runner and rollback support
- idempotent seed system
- authentication and refresh-token session flow
- RBAC catalog, role management, and user-role assignment APIs
- tenant configuration APIs for settings, theme, modules, terminology, custom fields, option sets, and form layouts
- CRM APIs for leads, accounts, contacts, opportunities, campaigns, and shared productivity records
- sales workspace APIs for SDR and inside-sales queues, workflow state, and lead handoff updates
- audit logging for auth, RBAC, tenant-config, and CRM writes
- production-style Docker image definitions for the API and web app
- GitHub Actions CI for install, typecheck, build, offline tests, and container build validation

### Shared Packages

- `@crm/types`
- `@crm/config`
- `@crm/ui`
- `@crm/auth`
- `@crm/ai`
- `@crm/database`

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Start PostgreSQL

Use a local PostgreSQL instance or the repository `docker-compose.yml` service.

Default local connection string:

```text
postgresql://crm:crm@localhost:5433/crm
```

### 3. Run migrations and seeds

```bash
npm run db:migrate
npm run db:seed
```

### 4. Start the applications

```bash
npm run dev
```

Frontend:
- `http://127.0.0.1:5173`

API:
- `http://127.0.0.1:4000/api/v1`

### 5. Optional full Docker stack

```bash
npm run docker:config
npm run docker:up
```

Docker stack URLs:
- web: `http://localhost:5173`
- API: `http://localhost:4000/api/v1`

Stop the stack:

```bash
npm run docker:down
```

## Seeded Admin Login

Default local bootstrap values:
- tenant slug: `sample-tenant`
- email: `admin@sample-tenant.local`
- password: `ChangeMe123!`

Change these through environment variables before using anything beyond local development.

## CRM Routes

- `/leads`
- `/leads/new`
- `/accounts`
- `/accounts/new`
- `/contacts`
- `/contacts/new`
- `/opportunities`
- `/opportunities/new`
- `/sales/sdr`
- `/sales/inside-sales`
- `/campaigns`
- `/campaigns/new`

Detail and edit routes are protected and permission-aware.

## Useful Commands

```bash
npm run db:status
npm run db:migrate
npm run db:rollback
npm run db:seed
npm run typecheck
npm run build
npm test
npm run docker:config
npm run docker:build
node tests/phase8-campaigns-exhaustive.mjs
node tests/phase10-opportunities-exhaustive.mjs
node tests/phase30-deployment-devops-exhaustive.mjs
```

## Testing

Automated tests (Vitest) run offline with no server or database required:

```bash
npm test            # builds shared packages, then runs backend + frontend suites
npm run test:api    # backend only (apps/api)
npm run test:web    # frontend only (apps/web)
npm run test:coverage
```

The live, data-backed end-to-end scripts run against a started server + seeded
database and remain the deepest gate:

```bash
node tests/phase27-audit-security-governance-exhaustive.mjs
node tests/phase29-observability-performance-exhaustive.mjs
node tests/phase30-deployment-devops-exhaustive.mjs
```

See [docs/testing/TESTING_STRATEGY.md](docs/testing/TESTING_STRATEGY.md) for the
full approach and [docs/testing/QA_CHECKLIST.md](docs/testing/QA_CHECKLIST.md)
for the manual release checklist.

## Environment Highlights

Important variables:
- `DATABASE_URL`
- `DATABASE_ENABLED`
- `API_CORS_ORIGIN`
- `JWT_ACCESS_TOKEN_SECRET`
- `JWT_REFRESH_TOKEN_SECRET`
- `DEFAULT_TENANT_SLUG`
- `DEFAULT_TENANT_NAME`
- `DEFAULT_ADMIN_EMAIL`
- `DEFAULT_ADMIN_PASSWORD`
- `SESSION_COOKIE_NAME`
- `VITE_API_BASE_URL`
- `METRICS_ENABLED`
- `SLOW_QUERY_THRESHOLD_MS`
- `DASHBOARD_CACHE_ENABLED`
- `RUN_MIGRATIONS`
- `RUN_SEED`

For local browser auth, the default CORS configuration supports both:
- `http://127.0.0.1:5173`
- `http://localhost:5173`

## Current Limits

Not implemented yet:
- public registration
- admin-created user lifecycle UI
- lead conversion
- dedicated ticket and customer-success operational modules
- dynamic form rendering from custom-field metadata
- record-level authorization beyond tenant boundaries
- Redis-backed caching and workers
- AI execution runtime
- production registry publishing and environment-specific deployment automation

## Documentation Map

- technical design: [docs/technical/TECHNICAL_DESIGN.md](docs/technical/TECHNICAL_DESIGN.md)
- data model: [docs/technical/DATA_MODEL.md](docs/technical/DATA_MODEL.md)
- migrations and seeds: [docs/technical/DATABASE_MIGRATIONS.md](docs/technical/DATABASE_MIGRATIONS.md)
- API surface: [docs/technical/API_DOCUMENTATION.md](docs/technical/API_DOCUMENTATION.md)
- module catalog: [docs/business/MODULE_CATALOG.md](docs/business/MODULE_CATALOG.md)
- campaign functional spec: [docs/business/CAMPAIGN_MANAGEMENT_FUNCTIONAL_SPEC.md](docs/business/CAMPAIGN_MANAGEMENT_FUNCTIONAL_SPEC.md)
- functional specification: [docs/business/FUNCTIONAL_SPECIFICATION.md](docs/business/FUNCTIONAL_SPECIFICATION.md)
- user guide: [docs/user-guides/USER_GUIDE.md](docs/user-guides/USER_GUIDE.md)
- marketing guide: [docs/user-guides/MARKETING_USER_GUIDE.md](docs/user-guides/MARKETING_USER_GUIDE.md)
- sales guide: [docs/user-guides/SALES_USER_GUIDE.md](docs/user-guides/SALES_USER_GUIDE.md)
- multi-tenancy: [docs/architecture/MULTI_TENANCY_DESIGN.md](docs/architecture/MULTI_TENANCY_DESIGN.md)
- security design: [docs/security/SECURITY_DESIGN.md](docs/security/SECURITY_DESIGN.md)
- testing strategy: [docs/testing/TESTING_STRATEGY.md](docs/testing/TESTING_STRATEGY.md)
- manual QA checklist: [docs/testing/QA_CHECKLIST.md](docs/testing/QA_CHECKLIST.md)
