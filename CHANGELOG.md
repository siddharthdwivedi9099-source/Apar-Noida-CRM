# Changelog

## Purpose

This file records notable changes to the repository and platform over time. It is intended to help contributors, reviewers, operators, and future release managers understand what changed, why it changed, and what level of compatibility risk the change introduces.

The project follows semantic versioning and uses a changelog style inspired by Keep a Changelog.

## Scope

This file should capture:
- meaningful repository and product changes
- compatibility-impacting changes
- documentation and governance milestones
- security-relevant release notes

This file should not become:
- a commit-by-commit activity log
- a substitute for implementation design documentation
- a place for undocumented breaking changes

## Entry Conventions

Each release entry should capture:
- the release version
- the release date
- notable additions, changes, fixes, removals, and documentation updates
- any important compatibility or migration notes

Recommended headings for future releases:
- `Added`
- `Changed`
- `Fixed`
- `Deprecated`
- `Removed`
- `Security`
- `Notes`

## [Unreleased]

This section represents the **current implemented repository state after `v0.1.0`**. It has been completed in the repository, but it has not yet been cut as a separately documented release version.

### Added

- npm workspace setup for `apps/*` and `packages/*`
- runnable React + TypeScript + Vite frontend in `apps/web`
- Tailwind CSS and ShadCN-ready frontend structure
- responsive web shell with sidebar, topbar, theme toggle, and placeholder module pages
- runnable Express + TypeScript API in `apps/api`
- versioned API routing under `/api/v1`
- health check endpoint at `/api/v1/health`
- API environment parsing and validation
- centralized API error handling and request logging middleware
- database and Redis connection placeholder services
- initialized shared packages for config, types, UI, auth, AI, and database concerns
- DevOps guide for local development and workspace operations

### Changed

- `README.md` now reflects the actual Phase 1 workspace and run commands
- technical and architecture documentation now describe the implemented stack rather than only the Phase 0 intent
- testing strategy now includes concrete Phase 1 verification steps

### Notes

- Phase 0 is complete
- Phase 1 initialization is complete in the repository
- Authentication, RBAC, tenant-context propagation, business modules, persistence, and AI execution remain intentionally out of scope so far
- The next implementation phase should begin with Authentication and RBAC rather than with new CRM module delivery

## [v0.1.0] - 2026-06-14

### Added

- Repository foundation for `apps`, `packages`, `docs`, `scripts`, and `tests`
- Root project governance and release documentation
- Business documentation covering product vision, business requirements, functional scope, module catalog, and role catalog
- Technical and architecture documentation covering system direction, conceptual data model, modular architecture, and multi-tenancy strategy
- Security documentation covering baseline security design and a first-pass RBAC matrix
- AI documentation covering AI architecture, gateway, prompt registry, agent registry, RAG, and customer query handling design
- Customer success, training, and health score design documentation
- Testing strategy and deployment readiness documentation
- Local environment template in `.env.example`
- Development dependency scaffold in `docker-compose.yml`

### Notes

- This release is intentionally documentation-first
- No application code, APIs, authentication, AI runtime logic, or database implementation are included
- This release established the baseline that Phase 1 later built on

## Future Update Guidance

When later phases begin, every material change should update this file in the same change set. The changelog should remain high-signal and focused on behavior, capability, operational, and compatibility impact rather than line-by-line edit history.
