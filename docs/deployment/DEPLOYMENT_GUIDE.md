# Deployment Guide

## Purpose

This guide defines the Phase 30 deployment baseline: how the web and API are packaged, how the local full stack runs, how CI verifies changes, and what must be true before promoting a build.

## Phase 30 Deployment Artifacts

Phase 30 adds concrete deployment assets:

- `.dockerignore` — keeps dependencies, build output, local secrets, and editor noise out of image contexts.
- `apps/api/Dockerfile` — multi-stage production image for the compiled Express API.
- `apps/api/docker-entrypoint.sh` — optional migration/seed entrypoint controlled by `RUN_MIGRATIONS` and `RUN_SEED`.
- `apps/web/Dockerfile` — multi-stage Vite build served by nginx.
- `apps/web/nginx.conf` — SPA fallback and long-cache rules for fingerprinted assets.
- `docker-compose.yml` — local full-stack topology for Postgres, Redis, MinIO, API, and web.
- `.github/workflows/ci.yml` — CI pipeline for install, typecheck, build, offline tests, and container image build validation.

## Local Full-Stack Run

Start the full stack:

```bash
npm run docker:up
```

This builds and starts:

- web: `http://localhost:5173`
- API: `http://localhost:4000/api/v1`
- Postgres: host port `5433`
- Redis: host port `6380`
- MinIO API/console: host ports `9002` and `9003`

Infrastructure-only mode remains available:

```bash
npm run docker:infra
```

Validate Compose syntax:

```bash
npm run docker:config
```

Stop the stack:

```bash
npm run docker:down
```

## Render Free Demo

The root `render.yaml` Blueprint deploys a single public Docker web service and
a private Render Postgres database in Singapore. The API serves the compiled
React app in production, so browser requests and secure refresh cookies stay on
one HTTPS origin.

Create a Render Blueprint from this repository and select the
`dashboard-rbac-and-config` branch. During initial creation, provide a unique
`DEFAULT_ADMIN_PASSWORD` with at least eight characters.

Render generates both JWT secrets and injects the private database connection
string. The container runs idempotent migrations and seeds before starting.
Open the generated `onrender.com` URL and sign in with tenant slug `apar-elite`.
The Render demo also seeds one account per canonical role using emails derived
from `<role-slug>@apar-elite.com` (hyphens become dots) and the shared password
configured in `DEMO_USER_PASSWORD`.

The free web service sleeps after inactivity and can take about a minute to wake.
The free Postgres database expires after 30 days, so this topology is for demos,
not durable production data.

## Container Behavior

### API

The API image compiles shared package dependencies and `@crm/api`, prunes dev dependencies, runs as a non-root `crm` user, and exposes port `4000`.

Health check:

```text
GET /api/v1/health
```

Startup migration behavior:

- `RUN_MIGRATIONS=true` runs `node scripts/database.mjs migrate`.
- `RUN_SEED=true` runs `node scripts/database.mjs seed`.
- `RUN_DEMO_SEED=true` runs `node scripts/seed-demo-users.mjs` after the core seed.
- For production, run migrations as a deliberate release step unless the environment explicitly accepts startup migrations.

### Web

The web image builds the Vite app with `VITE_API_BASE_URL` and serves static output from nginx on port `80`.

Nginx behavior:

- `/assets/*` receives long-cache immutable headers.
- unknown paths fall back to `/index.html` for React Router routes.

## CI Flow

The GitHub Actions workflow performs:

1. `npm ci`
2. `npm run typecheck`
3. `npm run build`
4. `npm test`
5. `docker compose build api web`

Database-backed exhaustive phase scripts remain manual/live-environment gates because they require a running API and seeded Postgres.

## Release Promotion Guidance

Recommended release flow:

1. Run CI on the branch.
2. Run `npm run docker:config`.
3. Build images with `npm run docker:build`.
4. Apply migrations intentionally in staging.
5. Seed only when intended and idempotent.
6. Run smoke checks against `/api/v1/health`, `/api/v1/ready`, `/api/v1/metrics`, and the web login route.
7. Promote the same image digests to production.
8. Monitor readiness, error rate, slow queries, and audit/security events after deployment.

## Secrets and Configuration

Use `.env.example` as the reference only. Production secrets must live in the deployment platform secret manager, not in Git or container images.

Minimum production secret review:

- `DATABASE_URL`
- `POSTGRES_PASSWORD`
- `JWT_ACCESS_TOKEN_SECRET`
- `JWT_REFRESH_TOKEN_SECRET`
- `DEFAULT_ADMIN_PASSWORD`
- object-storage credentials
- AI provider API keys

## Rollback

Rollback should use immutable image tags or digests. If a migration is not backward-compatible, pause promotion until a tested rollback or forward-fix path exists.
