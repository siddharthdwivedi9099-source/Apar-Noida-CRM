# Changelog

## [Unreleased]

Current repository state now includes Phase 1 through Phase 8 implementation work.

### Added

- Phase 8 migration `20260616190000_phase8_campaign_management.sql`
- tenant-scoped `campaigns` and `campaign_members` tables
- campaign CRUD APIs
- campaign member APIs for leads, contacts, and accounts
- campaign options API backed by seeded tenant option sets
- shared record APIs for:
  - notes read
  - activities read
  - campaign support across notes, activities, tasks, and timeline
- campaign frontend for:
  - dashboard placeholder
  - list
  - detail
  - create and edit form
  - member management
  - calendar placeholder
  - permission-aware AI placeholders
- new campaign functional specification and marketing user guide

### Changed

- platform metadata now reflects Phase 8: Campaign Management and Marketing Foundation
- shared CRM productivity tables now accept `campaign` as a supported record type
- campaign option sets and campaign form-layout metadata are now part of the default tenant seed
- the old campaign placeholder route has been replaced with a real module wired to PostgreSQL and RBAC
- data model, module catalog, API docs, and user-facing docs now reflect the live campaign module

### Security

- campaign routes now enforce module-aware RBAC checks
- campaign owner updates and member lifecycle mutations enforce assign-aware authorization rules
- campaign, campaign-member, note, activity, and task writes remain tenant-scoped and audit logged

### Notes

- dedicated opportunity, ticket, and customer-success-account primary tables are still future work
- campaign performance analytics, attribution, and true scheduling remain placeholders in this phase
- the campaign foundation is now live and ready for later marketing automation, attribution, and AI Gateway integration
