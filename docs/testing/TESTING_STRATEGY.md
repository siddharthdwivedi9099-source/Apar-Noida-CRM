# Testing Strategy

## Purpose

This document defines how the initialized workspace should be verified in Phase 1 and how testing should evolve as real platform features are added.

## Scope

This document covers:
- current verification expectations
- future automated testing layers
- environment and data expectations
- release gates
- implementation guidance for upcoming phases

This document does not cover:
- framework-specific test runner configuration
- CI pipeline syntax
- module-specific test cases

## Phase 1 Testing Objectives

- ensure the web app starts locally
- ensure the API starts locally
- ensure the versioned health endpoint works
- protect shared package contracts from drift
- keep architecture and documentation aligned with runtime reality

## Current Verification Baseline

Phase 1 is primarily validated through:
- workspace typechecks
- workspace builds
- local runtime smoke tests
- manual route verification
- health endpoint verification

## Required Phase 1 Checks

### Workspace Typecheck

```bash
npm run typecheck
```

Purpose:
- verify TypeScript correctness across the web, API, and shared packages

### Workspace Build

```bash
npm run build
```

Purpose:
- verify the frontend bundles successfully
- verify the API compiles successfully

### Frontend Smoke Test

Run:

```bash
npm run dev:web
```

Verify:
- the app opens at `http://localhost:5173`
- the shell renders
- navigation works across placeholder pages
- theme switching behaves as expected

### API Smoke Test

Run:

```bash
npm run dev:api
```

Verify:
- the server boots successfully
- `GET /api/v1/health` returns `200`
- the response includes environment and placeholder dependency health

## Future Test Layers

### Unit Tests

Should validate:
- utility behavior
- validation helpers
- shared package functions
- pure business logic once introduced

### Integration Tests

Should validate:
- API middleware composition
- route and error behavior
- future database and Redis integration boundaries
- shared contracts across apps

### Contract Tests

Should validate:
- API response schemas
- shared types and DTO assumptions
- AI request and response contracts when introduced

### End-to-End Tests

Should validate:
- login flows once auth exists
- cross-page navigation with live data
- core CRM lifecycle workflows
- key support and customer-success flows

### Security Tests

Should validate:
- access control
- tenant isolation
- input validation behavior
- unsafe administrative path protections

### AI Evaluations

Should validate:
- prompt regressions
- retrieval quality
- policy compliance
- tool-use boundaries

## Test Data Strategy

- keep Phase 1 free of production-like sensitive data
- use synthetic fixtures for future API and UI tests
- isolate tenant-oriented datasets once multi-tenant logic is introduced

## Release Gates

Current release gates should include:
- successful `npm install`
- successful `npm run typecheck`
- successful `npm run build`
- working API health endpoint
- updated documentation for material architectural changes

## Implementation Guidance

The next phase should add:
- automated API route tests
- frontend component and routing smoke tests
- a basic CI workflow for install, typecheck, and build
- failing tests for auth and tenancy edge cases before deep business logic grows

## Phase 1 Note

The repository now has executable applications, but it still relies on smoke-test style verification rather than a full automated test suite.
