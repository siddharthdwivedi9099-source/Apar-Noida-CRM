# AI-Native CRM Platform

## Current State

This repository now contains the implemented foundation for:
- Phase 1: web and API initialization
- Phase 2: PostgreSQL integration, migrations, seeds, and base schema
- Phase 3: authentication, session handling, and protected frontend routing
- Phase 4: RBAC, role templates, permission middleware, and admin role management

The current codebase is intentionally platform-first. CRM business entities and workflows are still future work.

## What Exists Now

### Frontend

- React + TypeScript + Vite
- protected routing with current-user loading
- working login page
- auth state provider
- logout from the application shell
- redirected access to protected routes
- permission-aware navigation and route access states
- admin role-management workspace

### Backend

- Express + TypeScript API
- PostgreSQL-backed database health
- migration CLI and SQL migration chain
- idempotent seed system
- base multi-tenant schema
- login, logout, refresh, and current-user endpoints
- RBAC catalog, role-management, and user-role assignment endpoints
- JWT access and refresh token handling
- database-backed session tracking
- login rate limiting, account lockout, and auth audit logs
- permission middleware for RBAC-protected endpoints

### Shared Packages

- `@crm/types`
- `@crm/config`
- `@crm/ui`
- `@crm/auth`
- `@crm/ai`
- `@crm/database`

## Repository Structure

```text
apps/
  web/                React + Vite frontend
  api/                Express + TypeScript API

packages/
  types/              Shared contracts
  config/             Shared platform constants
  ui/                 Shared UI primitives and tokens
  auth/               Shared auth route metadata
  ai/                 AI foundation package
  database/           PostgreSQL client, migrations, and seeds

docs/
  technical/          Data model, API, migrations
  architecture/       System and multi-tenancy design
  security/           Security, audit logging, and access control
  user-guides/        Admin workflow guidance
```

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Start PostgreSQL

Use a local PostgreSQL instance or the repository `docker-compose.yml` service.

Default connection string:

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

## Useful Commands

```bash
npm run db:create:migration -- add_contacts_table
npm run db:status
npm run db:migrate
npm run db:rollback
npm run db:seed
npm run typecheck
npm run build
```

## Environment Highlights

The canonical template lives in [`.env.example`](/Users/apar/Documents/CRM for Apar and eLite/.env.example).

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
- `VITE_DEFAULT_TENANT_SLUG`

For local browser auth, `API_CORS_ORIGIN` now supports a comma-separated allowlist. The default local setup includes both `http://127.0.0.1:5173` and `http://localhost:5173` so the refresh-cookie flow works in either dev URL.

## Current Limitations

Not implemented yet:
- public registration
- user-creation lifecycle UI
- business-module CRUD
- record-level authorization
- Redis-backed caching and workers
- AI execution runtime

## Documentation Map

- data model: [docs/technical/DATA_MODEL.md](docs/technical/DATA_MODEL.md)
- migrations and seeds: [docs/technical/DATABASE_MIGRATIONS.md](docs/technical/DATABASE_MIGRATIONS.md)
- API surface: [docs/technical/API_DOCUMENTATION.md](docs/technical/API_DOCUMENTATION.md)
- multi-tenancy: [docs/architecture/MULTI_TENANCY_DESIGN.md](docs/architecture/MULTI_TENANCY_DESIGN.md)
- security design: [docs/security/SECURITY_DESIGN.md](docs/security/SECURITY_DESIGN.md)
- access control: [docs/security/ACCESS_CONTROL_GUIDE.md](docs/security/ACCESS_CONTROL_GUIDE.md)
- audit logging: [docs/security/AUDIT_LOGGING_GUIDE.md](docs/security/AUDIT_LOGGING_GUIDE.md)
- admin workflow: [docs/user-guides/ADMIN_GUIDE.md](docs/user-guides/ADMIN_GUIDE.md)
