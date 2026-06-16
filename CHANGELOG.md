# Changelog

## [Unreleased]

Current repository state now includes Phase 1 through Phase 6 implementation work.

### Added

- Phase 6 migration `20260616130000_phase6_core_crm.sql`
- tenant-scoped `leads`, `accounts`, `contacts`, `crm_notes`, and `crm_activities` tables
- tenant-seeded dropdown catalogs for account type, account health, and contact role
- shared CRM API contracts in `@crm/types`
- CRM API routes for leads, accounts, and contacts:
  - list
  - detail
  - create
  - edit
  - soft delete
  - notes
  - activities
  - options lookups
- owner assignment and tenant option-set resolution in CRM services
- audit logging for CRM create, update, delete, note, and activity actions
- frontend CRM pages for:
  - leads list, detail, create, and edit
  - accounts list, detail, create, and edit
  - contacts list, detail, create, and edit
- permission-aware CRM route guards and navigation for contacts
- new sales user guide and refreshed module, functional, data-model, and API docs

### Changed

- platform metadata now reflects Phase 6: Core CRM Foundation
- dashboard copy now reflects live CRM modules instead of placeholder-only platform messaging
- README now documents the Phase 6 CRM surface and current limits
- Version documentation now reflects repository state through Phase 6

### Security

- CRM mutation endpoints now enforce permission-aware update paths
- CRM record reads and writes are tenant-scoped
- CRM notes and activities are included in the audit trail

### Notes

- opportunities are still a later phase
- lead conversion is still a placeholder
- dynamic custom-field rendering in live CRM forms is still future work

## [v0.1.0] - 2026-06-14

### Added

- repository foundation for `apps`, `packages`, `docs`, `scripts`, and `tests`
- root project governance and release documentation
- business documentation covering product vision, business requirements, functional scope, module catalog, and role catalog
- technical and architecture documentation covering system direction, conceptual data model, modular architecture, and multi-tenancy strategy
- security documentation covering baseline security design and a first-pass RBAC matrix
- AI documentation covering AI architecture, gateway, prompt registry, agent registry, RAG, and customer query handling design
- customer success, training, and health score design documentation
- testing strategy and deployment readiness documentation
- local environment template in `.env.example`
- development dependency scaffold in `docker-compose.yml`
