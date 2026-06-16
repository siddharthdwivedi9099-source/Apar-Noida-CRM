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

This section represents the **current implemented repository state after `v0.1.0`**. It now includes the Phase 1 runtime foundation plus Phase 2 database work, Phase 3 authentication work, Phase 4 RBAC work, and Phase 5 tenant configuration work.

### Added

- PostgreSQL-backed `@crm/database` package with a real connection pool and live database health checks
- SQL migration runner with create, status, migrate, and rollback commands
- idempotent core seed system for the default tenant, admin role, permission catalog, and admin user
- base tenant-aware schema including tenants, users, teams, departments, roles, permissions, role assignments, audit logs, system settings, and auth sessions
- soft-delete-ready metadata and timestamp conventions across core mutable tables
- authentication API endpoints for login, logout, refresh, and current user
- JWT access and refresh token flow with database-backed session tracking
- failed login handling, account lockout, login rate limiting, and auth audit logging
- frontend auth state provider, protected routes, working login page, current-user loading, and logout control
- RBAC role-template catalog, role CRUD APIs, permission assignment APIs, and user-role assignment APIs
- permission middleware for protected RBAC endpoints
- admin role-management UI with role creation, permission editing, and user-role assignment
- permission-aware sidebar navigation and route-level access-denied rendering in the frontend
- technical, architecture, security, admin, audit, access-control, and API documentation for the new database and auth foundation
- tenant configuration APIs for workspace settings, theme settings, module switches, terminology, custom fields, option sets, and form layouts
- frontend tenant settings provider that bootstraps tenant configuration after auth
- admin settings workspace at `/admin` with dedicated theme, modules, terminology, and custom-field pages
- live tenant theme reflection across the frontend shell using CSS variables and tenant-config-driven data attributes
- seeded tenant option sets for lead statuses, lead sources, opportunity pipelines, support ticket statuses, and customer-success stages
- seeded form-layout metadata for future lead, account, and contact forms

### Changed

- `README.md` now documents database setup, migration commands, seed flow, and seeded admin login
- `.env.example` now includes database pool, admin bootstrap, JWT, cookie, and login rate-limit configuration
- platform metadata now reflects the database and authentication implementation phase
- the API health surface now reports real PostgreSQL connection status instead of a placeholder response
- the API now allows credentialed CORS for the configured frontend origin allowlist so browser-based login and refresh flows work reliably in local development
- the seed system now bootstraps the Phase 4 RBAC permission matrix, role templates, default tenant roles, and `super-admin` assignment
- the authenticated request context now resolves permission codes for permission middleware and frontend access trimming
- platform metadata now reflects Phase 5 tenant configuration work
- the admin route is now the tenant settings hub, while RBAC management moves to `/admin/rbac`
- sidebar visibility and route access now depend on both RBAC permission checks and tenant module enablement
- navigation and module copy now support tenant terminology overrides
- the seed system now bootstraps tenant theme, module, terminology, option-set, and form-layout defaults

### Security

- auth refresh tokens are now rotated and stored as hashes in the database
- password hashes are generated with PostgreSQL `pgcrypto`
- authentication failures now write structured audit events with request correlation metadata
- RBAC role creation, role updates, permission replacement, and user-role reassignment now write audit events
- tenant configuration updates now write structured audit events with actor, session, and request context

### Notes

- public self-signup is still intentionally out of scope
- business-module CRUD is still future work even though module-level permission vocabulary and UI/API gating are now in place
- custom-field and form-layout metadata now exist, but dynamic business-form rendering still belongs to a later phase
- local verification of migrations and seeds requires a reachable PostgreSQL instance at `DATABASE_URL`

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
