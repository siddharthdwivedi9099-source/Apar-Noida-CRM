# Changelog

## [Unreleased]

Current repository state now includes Phase 1 through Phase 9 implementation work.

### Added

- Phase 9 migration `20260616233000_phase9_social_media_marketing.sql`
- tenant-scoped `social_posts` and `social_post_channels` tables
- social post CRUD APIs
- social channels API and social options API
- social frontend for:
  - dashboard
  - content calendar
  - list
  - detail
  - create and edit form
  - approval status UI
  - campaign linkage
  - permission-aware AI placeholders
- social media marketing coverage in functional, technical, and marketing documentation

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

- platform metadata now reflects Phase 9: Social Media Marketing Module
- tenant option sets and form-layout metadata now include social channels, post statuses, approval statuses, and a default social layout
- the social module now replaces a previously vocabulary-only shell with a live PostgreSQL-backed workspace
- high-level repository phase references now include the social media marketing module
- platform metadata now reflects Phase 8: Campaign Management and Marketing Foundation
- shared CRM productivity tables now accept `campaign` as a supported record type
- campaign option sets and campaign form-layout metadata are now part of the default tenant seed
- the old campaign placeholder route has been replaced with a real module wired to PostgreSQL and RBAC
- data model, module catalog, API docs, and user-facing docs now reflect the live campaign module

### Security

- social routes now enforce module-aware RBAC checks
- social owner and campaign linkage updates enforce assign-aware authorization rules
- social approval updates enforce approval-aware authorization rules
- social post writes remain tenant-scoped and audit logged
- campaign routes now enforce module-aware RBAC checks
- campaign owner updates and member lifecycle mutations enforce assign-aware authorization rules
- campaign, campaign-member, note, activity, and task writes remain tenant-scoped and audit logged

### Notes

- social publishing, engagement ingestion, listening, competitor benchmarks, and social lead capture remain placeholders in this phase
- dedicated opportunity, ticket, and customer-success-account primary tables are still future work
- campaign performance analytics, attribution, and true scheduling remain placeholders in this phase
- the campaign foundation is now live and ready for later marketing automation, attribution, and AI Gateway integration
