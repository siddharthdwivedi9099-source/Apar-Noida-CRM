# DevOps Guide

## Purpose

This guide explains the current operational workflow for local development, containerized execution, CI, and release verification.

## Phase 30 DevOps Baseline

Phase 30 introduces a deployable local application stack and CI baseline:

- production-style API container image
- production-style web/nginx container image
- full-stack Docker Compose topology
- root Docker helper scripts
- GitHub Actions verification workflow
- expanded `.env.example` with secret markers and operational toggles

## Runtime Topology

### Frontend

- application: `apps/web`
- stack: React, TypeScript, Vite, Tailwind CSS
- local dev URL: `http://127.0.0.1:5173`
- container URL: `http://localhost:5173`

### API

- application: `apps/api`
- stack: Express, TypeScript, Zod, Pino
- local dev URL: `http://127.0.0.1:4000/api/v1`
- container URL: `http://localhost:4000/api/v1`
- liveness: `/api/v1/health` or `/api/v1/live`
- readiness: `/api/v1/ready`
- metrics placeholder: `/api/v1/metrics`

### Infrastructure

- PostgreSQL: host `localhost:5433`, container `postgres:5432`
- Redis: host `localhost:6380`, container `redis:6379`
- MinIO: host `localhost:9002`, console `localhost:9003`

## Local Commands

Install dependencies:

```bash
npm install
```

Run local app processes:

```bash
npm run dev
```

Run infrastructure only:

```bash
npm run docker:infra
```

Run full Docker stack:

```bash
npm run docker:up
```

View app container logs:

```bash
npm run docker:logs
```

Stop containers:

```bash
npm run docker:down
```

Validate Compose config:

```bash
npm run docker:config
```

## Verification Commands

Core offline gates:

```bash
npm run typecheck
npm run build
npm test
```

Deployment artifact gate:

```bash
node tests/phase30-deployment-devops-exhaustive.mjs
```

Live database-backed phase gates remain available under `tests/phase*-exhaustive.mjs` and require a running API plus seeded Postgres.

## CI Pipeline

The GitHub Actions workflow in `.github/workflows/ci.yml` runs on pushes to `main` and `codex-*` branches, plus pull requests into `main`.

The current pipeline:

- checks out code
- installs Node 20 dependencies with `npm ci`
- runs typecheck
- runs production build
- runs offline tests
- validates API and web image builds with `docker compose build api web`

Image publishing and production deployment are intentionally deferred until registry and environment targets are selected.

## Environment Management

Use `.env.example` as the reference. Do not commit real `.env` files.

Production and shared environments must override:

- database credentials and URL
- JWT secrets
- default admin bootstrap password
- object storage credentials
- AI provider API keys
- CORS origins
- cookie security settings
- audit and retention settings

## Operational Notes

- API containers run as a non-root `crm` user.
- API migrations and seeds are controlled by `RUN_MIGRATIONS` and `RUN_SEED`.
- Web builds bake `VITE_API_BASE_URL` at image build time.
- The nginx image supports React Router deep links through SPA fallback.
- Compose defaults are local-development defaults, not production secrets.

## Relationship to Other Docs

- deployment runbook: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- observability: [OBSERVABILITY_GUIDE.md](OBSERVABILITY_GUIDE.md)
- performance: [PERFORMANCE_GUIDE.md](PERFORMANCE_GUIDE.md)
- production checklist: [PRODUCTION_READINESS_CHECKLIST.md](PRODUCTION_READINESS_CHECKLIST.md)
- testing strategy: [../testing/TESTING_STRATEGY.md](../testing/TESTING_STRATEGY.md)
