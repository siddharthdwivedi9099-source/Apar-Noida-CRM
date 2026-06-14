# AI-Native CRM Platform

## Purpose

This repository contains the Phase 1 foundation of a production-ready, AI-native CRM platform designed to support the full customer lifecycle across marketing, sales, partner ecosystems, support, onboarding, and customer success.

The product target remains:
- a CRM system of record
- an AI system of intelligence
- a workflow and automation system of action

## Current Phase

The repository is currently in **Phase 1: Backend and Frontend Project Initialization**.

Phase 1 builds on the Phase 0 documentation baseline and introduces:
- a runnable frontend application in `apps/web`
- a runnable backend API in `apps/api`
- shared package initialization in `packages/*`
- local environment documentation and workspace scripts

## Release Status

- Latest formal release baseline: `v0.1.0`
- Current repository state: Phase 1 initialization is implemented and recorded in `CHANGELOG.md` under `Unreleased`
- Next implementation phase: **Authentication and RBAC**

## What Exists Now

### Frontend

- React + TypeScript + Vite
- Tailwind CSS
- ShadCN-ready structure
- React Router-based navigation
- responsive application shell with sidebar and topbar
- theme foundation with light and dark mode support
- placeholder pages for:
  - Login
  - Dashboard
  - Admin
  - Leads
  - Accounts
  - Opportunities
  - Campaigns
  - Support
  - Customer Success
  - AI Assistant

### Backend

- Node.js + Express + TypeScript
- `/api/v1` versioning structure
- health check endpoint
- centralized error handling
- request logging middleware
- environment parsing and validation
- database and Redis connection placeholders
- modular folder structure ready for future domain modules

### Shared Packages

- `packages/types`
- `packages/config`
- `packages/ui`
- `packages/auth`
- `packages/ai`
- `packages/database`

## What Still Does Not Exist

Phase 1 intentionally does **not** implement:
- authentication flows
- authorization logic
- CRM business workflows
- database persistence logic
- Redis caching logic
- AI model execution
- RAG pipelines
- production DevOps automation

## Repository Structure

```text
apps/
  web/                React + Vite frontend
  api/                Express + TypeScript API

packages/
  ui/                 Shared UI constants and design primitives
  config/             Shared platform and environment metadata
  types/              Shared platform and API types
  auth/               Authentication foundation placeholders
  ai/                 AI capability foundation placeholders
  database/           Database and Redis placeholder contracts

docs/
  business/           Product and business definitions
  technical/          Technical design and data model
  architecture/       Architecture and multi-tenancy design
  security/           Security and RBAC direction
  ai/                 AI platform architecture
  customer-success/   Post-sales functional design
  testing/            Testing strategy
  deployment/         Deployment, DevOps, and production guidance
```

## Technology Choices

### Frontend

- React 18
- TypeScript
- Vite
- React Router
- Tailwind CSS
- ShadCN-ready component structure

### Backend

- Node.js
- Express
- TypeScript
- Zod for environment and validation structure
- Pino for API logging

### Workspace

- npm workspaces
- shared root scripts for local development, build, and typecheck

## Getting Started

### Install dependencies

```bash
npm install
```

### Run the web app

```bash
npm run dev:web
```

The frontend runs at:
- [http://127.0.0.1:5173](http://127.0.0.1:5173)

### Run the API

```bash
npm run dev:api
```

The API runs at:
- [http://127.0.0.1:4000](http://127.0.0.1:4000)

### Run both together

```bash
npm run dev
```

## Verification Commands

### Frontend

Open the frontend and verify the sidebar and placeholder routes:
- `/login`
- `/dashboard`
- `/admin`
- `/leads`
- `/accounts`
- `/opportunities`
- `/campaigns`
- `/support`
- `/customer-success`
- `/ai-assistant`

### API health check

```bash
curl http://127.0.0.1:4000/api/v1/health
```

Expected behavior:
- HTTP `200`
- JSON response with service status, version, timestamp, environment, and database and Redis placeholder health

### Typecheck

```bash
npm run typecheck
```

### Build

```bash
npm run build
```

## Environment Variables

The canonical baseline lives in [`.env.example`](/Users/apar/Documents/CRM for Apar and eLite/.env.example).

### Frontend

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_APP_NAME` | Web application display name | `AI-Native CRM` |
| `VITE_API_BASE_URL` | API base URL used by future frontend integrations | `http://127.0.0.1:4000/api/v1` |
| `VITE_DEFAULT_THEME` | Default theme mode | `light` |
| `WEB_PORT` | Documented local frontend port | `5173` |

### API

| Variable | Purpose | Default |
| --- | --- | --- |
| `API_HOST` | API bind host | `127.0.0.1` |
| `API_PORT` | API port | `4000` |
| `API_CORS_ORIGIN` | Allowed local frontend origin | `http://127.0.0.1:5173` |
| `API_LOG_LEVEL` | API logging verbosity | `info` |
| `NODE_ENV` | Runtime environment | `development` |

### Placeholder Infrastructure

| Variable | Purpose | Default |
| --- | --- | --- |
| `DATABASE_ENABLED` | Enables future database connection bootstrap | `false` |
| `DATABASE_URL` | Future database connection string | `postgresql://crm:crm@localhost:5432/crm` |
| `REDIS_ENABLED` | Enables future Redis bootstrap | `false` |
| `REDIS_URL` | Future Redis connection string | `redis://localhost:6379` |

## Frontend Foundations

The frontend currently includes:
- routed placeholder pages for the initial product areas
- a responsive sidebar and topbar shell
- theme switching
- reusable `components/ui` primitives
- `components.json` and `lib/utils.ts` for ShadCN compatibility

The frontend does not yet include:
- authentication guards
- RBAC-aware route enforcement
- live data fetching
- tables, forms, or CRUD flows
- business logic

## API Foundations

The API currently includes:
- root bootstrap in `apps/api/src/server.ts`
- app composition in `apps/api/src/app.ts`
- versioned router mounted at `/api/v1`
- health endpoint in `apps/api/src/modules/health`
- middleware for logging, not found handling, and centralized errors
- environment parsing in `apps/api/src/config/env.ts`

The API does not yet include:
- domain controllers
- persistence repositories
- queue workers
- auth middleware
- RBAC enforcement
- tenant resolution

## Documentation Map

### Core technical docs

- [docs/technical/TECHNICAL_DESIGN.md](docs/technical/TECHNICAL_DESIGN.md)
- [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md)
- [docs/testing/TESTING_STRATEGY.md](docs/testing/TESTING_STRATEGY.md)
- [docs/deployment/DEVOPS_GUIDE.md](docs/deployment/DEVOPS_GUIDE.md)

### Platform and product docs

- [docs/business/PRODUCT_VISION.md](docs/business/PRODUCT_VISION.md)
- [docs/business/FUNCTIONAL_SPECIFICATION.md](docs/business/FUNCTIONAL_SPECIFICATION.md)
- [docs/security/SECURITY_DESIGN.md](docs/security/SECURITY_DESIGN.md)
- [docs/ai/AI_ARCHITECTURE.md](docs/ai/AI_ARCHITECTURE.md)

## Next Recommended Phase

The next recommended phase after this initialization is **Phase 2: Platform Core and Secure Access**, where we should implement:
- authentication and authorization
- RBAC enforcement
- tenant context propagation
- initial API contracts
- persistence adapters
- the first CRM kernel entities such as accounts, contacts, leads, and activities
