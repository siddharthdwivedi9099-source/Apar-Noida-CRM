# DevOps Guide

## Purpose

This document explains how the current workspace is run locally, how the frontend and API are structured operationally, and what the immediate DevOps expectations are for the repository at Phase 1.

## Scope

This guide covers:
- local development workflow
- workspace commands
- environment variables
- runtime ports
- current build and verification flow
- Phase 1 operational boundaries

This guide does not cover:
- production infrastructure automation
- CI/CD implementation details
- Kubernetes manifests
- secret management tooling selection

## Current Runtime Topology

### Frontend

- application: `apps/web`
- stack: React, TypeScript, Vite, Tailwind CSS
- local URL: `http://localhost:5173`

### API

- application: `apps/api`
- stack: Express, TypeScript, Zod, Pino
- local URL: `http://localhost:4000`
- health endpoint: `http://localhost:4000/api/v1/health`

### Local Infrastructure Placeholders

- PostgreSQL in `docker-compose.yml`
- Redis in `docker-compose.yml`
- MinIO in `docker-compose.yml`

These services are available for future phases, but the Phase 1 API only reports placeholder health and does not connect to them yet.

## Workspace Commands

### Install dependencies

```bash
npm install
```

### Run web only

```bash
npm run dev:web
```

### Run API only

```bash
npm run dev:api
```

### Run both applications

```bash
npm run dev
```

### Typecheck all workspaces

```bash
npm run typecheck
```

### Build all workspaces

```bash
npm run build
```

## Environment Baseline

The environment reference file is [`.env.example`](/Users/apar/Documents/CRM for Apar and eLite/.env.example).

### Frontend-related variables

- `VITE_APP_NAME`
- `VITE_API_BASE_URL`
- `VITE_DEFAULT_THEME`
- `WEB_PORT`

### API-related variables

- `API_HOST`
- `API_PORT`
- `API_CORS_ORIGIN`
- `API_LOG_LEVEL`
- `NODE_ENV`

### Placeholder infrastructure variables

- `DATABASE_ENABLED`
- `DATABASE_URL`
- `REDIS_ENABLED`
- `REDIS_URL`

## Local Verification Flow

### Frontend verification

1. Start the web app with `npm run dev:web`.
2. Open `http://localhost:5173`.
3. Verify that the sidebar, topbar, theme toggle, and placeholder routes render correctly.

### API verification

1. Start the API with `npm run dev:api`.
2. Call `curl http://localhost:4000/api/v1/health`.
3. Confirm the JSON response includes status, version, environment, and placeholder dependency health.

### Build verification

1. Run `npm run typecheck`.
2. Run `npm run build`.
3. Confirm both workspaces complete successfully.

## Logging and Error Handling

### API logging

- request logging is enabled through a centralized middleware
- server startup uses a structured Pino logger
- centralized error responses are returned by the API error handler

### Frontend

- no telemetry or error reporting service is configured yet
- the current goal is reliable local initialization and layout verification

## Operational Boundaries in Phase 1

Phase 1 is intentionally limited to initialization and should not be treated as production-ready runtime behavior.

Current limitations:
- no auth
- no persistence
- no migrations
- no caching
- no background jobs
- no CI/CD pipeline automation
- no production deploy pipeline

## Immediate DevOps Next Steps

The next operational tasks after Phase 1 should be:
- add linting and CI checks
- define container build strategy for the web and API
- add environment-specific configuration handling
- introduce secrets management conventions
- add smoke-test automation for the health endpoint and basic frontend boot
- define deployment promotion stages

## Relationship to Other Docs

- high-level deployment direction: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- technical stack and module design: [../technical/TECHNICAL_DESIGN.md](../technical/TECHNICAL_DESIGN.md)
- architecture boundaries: [../architecture/ARCHITECTURE.md](../architecture/ARCHITECTURE.md)
- testing approach: [../testing/TESTING_STRATEGY.md](../testing/TESTING_STRATEGY.md)
