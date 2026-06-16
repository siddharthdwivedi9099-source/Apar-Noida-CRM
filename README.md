# AI-Native CRM Platform

## Current State

This repository now contains the implemented foundation for:
- Phase 1: web and API initialization
- Phase 2: PostgreSQL integration, migrations, seeds, and base schema
- Phase 3: authentication, session handling, and protected frontend routing
- Phase 4: RBAC, role templates, permission middleware, and admin role management
- Phase 5: tenant settings, theme configuration, module switches, terminology, and custom-field metadata foundations
- Phase 6: leads, accounts, and contacts CRM foundation

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

### Backend

- Express + TypeScript API
- PostgreSQL-backed health checks
- SQL migration runner and rollback support
- idempotent seed system
- authentication and refresh-token session flow
- RBAC catalog, role management, and user-role assignment APIs
- tenant configuration APIs for settings, theme, modules, terminology, custom fields, option sets, and form layouts
- CRM APIs for leads, accounts, contacts, notes, and activities
- audit logging for auth, RBAC, tenant-config, and CRM writes

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

Detail and edit routes are protected and permission-aware.

## Useful Commands

```bash
npm run db:status
npm run db:migrate
npm run db:rollback
npm run db:seed
npm run typecheck
npm run build
```

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

For local browser auth, the default CORS configuration supports both:
- `http://127.0.0.1:5173`
- `http://localhost:5173`

## Current Limits

Not implemented yet:
- public registration
- admin-created user lifecycle UI
- opportunities
- lead conversion
- dynamic form rendering from custom-field metadata
- record-level authorization beyond tenant boundaries
- Redis-backed caching and workers
- AI execution runtime

## Documentation Map

- technical design: [docs/technical/TECHNICAL_DESIGN.md](docs/technical/TECHNICAL_DESIGN.md)
- data model: [docs/technical/DATA_MODEL.md](docs/technical/DATA_MODEL.md)
- migrations and seeds: [docs/technical/DATABASE_MIGRATIONS.md](docs/technical/DATABASE_MIGRATIONS.md)
- API surface: [docs/technical/API_DOCUMENTATION.md](docs/technical/API_DOCUMENTATION.md)
- module catalog: [docs/business/MODULE_CATALOG.md](docs/business/MODULE_CATALOG.md)
- functional specification: [docs/business/FUNCTIONAL_SPECIFICATION.md](docs/business/FUNCTIONAL_SPECIFICATION.md)
- sales guide: [docs/user-guides/SALES_USER_GUIDE.md](docs/user-guides/SALES_USER_GUIDE.md)
- multi-tenancy: [docs/architecture/MULTI_TENANCY_DESIGN.md](docs/architecture/MULTI_TENANCY_DESIGN.md)
- security design: [docs/security/SECURITY_DESIGN.md](docs/security/SECURITY_DESIGN.md)
