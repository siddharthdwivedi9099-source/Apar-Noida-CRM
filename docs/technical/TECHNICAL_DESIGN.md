# Technical Design

## Purpose

This document defines the implemented technical baseline for Phase 1 and explains how the workspace is structured for future platform development.

## Scope

This document covers:
- the current workspace and stack choices
- implemented frontend and backend initialization
- shared package responsibilities
- cross-cutting technical conventions
- implementation guidance for the next phase

This document does not cover:
- business module behavior
- authentication implementation
- database schema design
- infrastructure-as-code details

## Phase 1 Outcome

Phase 1 establishes a runnable application foundation while intentionally deferring domain implementation.

The repository now contains:
- a running React frontend
- a running Express API
- shared packages for cross-workspace foundations
- environment and local runtime conventions
- documented build and verification commands

## Implemented Stack

### Workspace and Tooling

- npm workspaces
- root scripts for local development, build, and typecheck
- shared TypeScript base configuration

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
- Zod
- Pino

## Repository Structure

### Applications

#### `apps/web`

Purpose:
- frontend runtime
- application shell
- route definitions
- placeholder product pages
- shared UI composition

Key implemented areas:
- `src/router.tsx`
- `src/components/layout`
- `src/components/ui`
- `src/pages`
- `src/providers`

#### `apps/api`

Purpose:
- API bootstrap
- middleware composition
- versioned routing
- health endpoints
- environment validation

Key implemented areas:
- `src/server.ts`
- `src/app.ts`
- `src/config`
- `src/common`
- `src/modules/health`
- `src/platform`

### Shared Packages

#### `packages/types`

Holds shared platform and API-facing TypeScript types.

#### `packages/config`

Holds shared metadata such as platform naming, API versioning, and workspace-level configuration constants.

#### `packages/ui`

Holds shared UI constants and layout tokens that can later expand into a design system package.

#### `packages/auth`

Holds authentication-related placeholders and route metadata without implementing auth behavior yet.

#### `packages/ai`

Holds AI capability placeholder definitions used by the frontend foundation.

#### `packages/database`

Holds placeholder database and Redis contracts used by the API health surface.

## Frontend Technical Design

### Routing

The frontend uses React Router with:
- a public login route
- a shared application shell route
- placeholder module routes under the shell

### Layout System

The shell includes:
- a responsive sidebar
- a topbar
- theme switching
- a reusable card and badge foundation

### Styling Direction

The frontend uses:
- Tailwind CSS utility composition
- CSS custom properties for theme tokens
- ShadCN-ready `components.json`
- a `lib/utils.ts` utility for `cn()` composition

### Current Boundary

The frontend is intentionally presentation-only at this stage. It does not:
- fetch live API data
- guard routes
- submit forms
- implement business objects

## Backend Technical Design

### API Versioning

The API is mounted under:

```text
/api/v1
```

This is defined centrally and already in use by the health endpoint.

### Middleware Stack

The API currently includes:
- request logging middleware
- JSON and URL-encoded body parsing
- CORS
- Helmet
- centralized 404 handling
- centralized error handling

### Validation Structure

Validation is organized through shared middleware so future routes can adopt consistent request parsing and error behavior.

### Placeholder Dependency Services

The API includes placeholder services for:
- PostgreSQL
- Redis

These do not create live connections yet. They exist to provide health output structure and future extension points.

## Cross-Cutting Technical Conventions

### Type Safety

- both apps are TypeScript-based
- shared packages define reusable types
- workspace-wide typecheck is part of the development workflow

### Versioning

- API versioning starts at `/api/v1`
- package versions remain aligned at `0.1.0` for now
- changelog documents phase-based delivery

### Environment Handling

- local environment variables are documented in `.env.example`
- API env values are parsed and validated through Zod
- frontend env expectations are documented even when not yet heavily used

## Current Non-Goals

Phase 1 does not implement:
- persistence repositories
- migrations
- auth
- tenancy resolution
- background workers
- AI execution
- module-specific APIs

## Implementation Guidance

The next implementation phase should:
- introduce authentication and authorization before business-module CRUD work
- propagate tenant context through API request handling
- begin defining shared API contracts for CRM core entities
- keep frontend data access centralized instead of sprinkling fetch logic through page components
- preserve the current separation between platform foundations and business modules

## Phase 1 Note

This document reflects actual initialized runtime code, but the platform remains at the foundation stage rather than the feature-complete stage.
