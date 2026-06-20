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

---

# Phase 28: Automated Testing Framework and Coverage

Phase 28 introduces an automated test framework alongside the existing live
`tests/phase*-exhaustive.mjs` end-to-end scripts. The automated suites are fast,
offline, and require **no running server or database**, so they are safe to run
in CI and on every change.

## Test Framework

- **Runner:** [Vitest](https://vitest.dev) 2.x (shares the repo's Vite 5 toolchain).
- **Backend (`@crm/api`):** Vitest `node` environment + [supertest](https://github.com/ladjs/supertest) for HTTP contract tests.
- **Frontend (`@crm/web`):** Vitest `jsdom` environment + [@testing-library/react](https://testing-library.com) + `@testing-library/jest-dom`.
- Test tooling is installed once at the repository root and shared by both workspaces.

## How to Run Tests

```bash
# Everything (builds shared packages, then runs backend + frontend suites)
npm test

# Individual suites
npm run test:api      # backend (apps/api)
npm run test:web      # frontend (apps/web)

# Coverage (text + HTML report under each app's coverage/ directory)
npm run test:coverage

# Watch mode while developing a single app
npm run test:watch --workspace @crm/api
npm run test:watch --workspace @crm/web
```

The existing live, data-backed validation scripts still run against a started
server + seeded database and remain the deepest end-to-end gate:

```bash
node tests/phase27-audit-security-governance-exhaustive.mjs
```

## Test Layout

```
apps/api/
  vitest.config.ts          # node env, db/redis disabled, log level silent
  test/
    unit/                   # pure logic: jwt, authorize (RBAC), rate-limit,
                            # error-handler, rbac/workflow/ai/prompt/rag catalogs,
                            # workflow condition engine, customer-query escalation
    integration/            # supertest API contract + AuthService identity/tenant isolation
apps/web/
  vitest.config.ts          # jsdom env, "@/" alias, jest-dom setup
  test/
    setup.ts                # registers jest-dom matchers + DOM cleanup
    *.test.tsx              # RBAC nav logic, login page, protected route,
                            # and component smoke tests for key pages
```

## Coverage Approach

Coverage is layered by cost and determinism rather than chasing a single
percentage target:

1. **Pure unit tests (no I/O):** middleware (auth/RBAC, rate limiting, error
   handling), the JWT layer, the workflow condition engine, customer-query
   severity classification + escalation, and the seeded catalogs (permissions,
   role templates, prompt registry, AI providers, knowledge sources). These are
   exhaustive and run in milliseconds.
2. **API contract tests (supertest, DB disabled):** confirm every protected
   module mounts and enforces authentication, that the API root and structured
   404/validation responses behave, and that security headers are applied. This
   guarantees route wiring and the security gate for each API surface without a
   database.
3. **Service-level tests with a faked database:** `AuthService` access-token
   identity resolution and tenant isolation (tenant/user/session mismatch,
   revocation, bad tokens) are exercised against an in-memory fake of the
   database layer.
4. **Frontend component tests (jsdom):** the login form, the authenticated route
   gate, role-based navigation gating, and mount/loading smoke tests for the
   lead form, opportunity board, ticket/support page, customer-success
   dashboard, and AI assistant panel.
5. **Live end-to-end scripts (`tests/phase*-exhaustive.mjs`):** deep, data-backed
   coverage against a real server + PostgreSQL, kept as the strongest gate.

`npm run test:coverage` produces V8 coverage reports per app for tracking trends.

## Backend Test Areas

| Area | File |
| --- | --- |
| Auth (token layer) | `test/unit/jwt.test.ts` |
| Auth + tenant isolation (identity) | `test/integration/auth-identity.test.ts` |
| RBAC (middleware) | `test/unit/authorize.test.ts` |
| RBAC (catalog + role templates) | `test/unit/rbac-catalog.test.ts` |
| Security (rate limiting) | `test/unit/rate-limit.test.ts` |
| Error handling | `test/unit/error-handler.test.ts` |
| Lead / Account / Contact / Opportunity / Campaign / Ticket / Customer Success / Training APIs | `test/integration/api-contract.test.ts` |
| AI Gateway | `test/unit/ai-gateway.test.ts` |
| Prompt + Agent Registry | `test/unit/prompt-registry.test.ts` |
| RAG retrieval | `test/unit/rag-retrieval.test.ts` |
| Customer query escalation | `test/unit/customer-query-escalation.test.ts` |
| Workflow engine | `test/unit/workflow-engine.test.ts` |

## Frontend Test Areas

| Area | File |
| --- | --- |
| Login page | `test/login-page.test.tsx` |
| Protected route | `test/protected-route.test.tsx` |
| Role-based navigation | `test/rbac.test.ts` |
| Lead form | `test/lead-form-page.test.tsx` |
| Opportunity board | `test/opportunities-page.test.tsx` |
| Ticket page | `test/support-page.test.tsx` |
| Customer success dashboard | `test/customer-success-page.test.tsx` |
| AI assistant panel | `test/ai-assistant-page.test.tsx` |

## Regression Testing Process

1. Run `npm test` before every commit/PR; it must be green.
2. Run `npm run typecheck` and `npm run build` for type and bundle safety.
3. When a defect is found, first add a failing automated test that reproduces it,
   then fix the code until the test passes (test-first regression guard).
4. For a feature that touches a live data flow, also run the relevant
   `tests/phase*-exhaustive.mjs` script against a seeded database.
5. Walk the [manual QA checklist](./QA_CHECKLIST.md) before a release.
6. Keep the per-phase test areas above in sync as modules evolve; a new module
   should ship with at least a contract test (backend) and a mount test (frontend).

## Updated Release Gates

- successful `npm install`
- successful `npm test` (automated backend + frontend suites)
- successful `npm run typecheck`
- successful `npm run build`
- relevant `tests/phase*-exhaustive.mjs` scripts pass against a seeded database
- completed [manual QA checklist](./QA_CHECKLIST.md) for release candidates
- updated documentation for material architectural changes
