# Changelog

## [Unreleased]

Current repository state now includes Phase 1 through Phase 11 implementation work.

### Added

- Phase 11 SDR and inside-sales workspace APIs:
  - `GET /sales-workspaces/options`
  - `GET /sales-workspaces/sdr`
  - `GET /sales-workspaces/inside-sales`
  - `PATCH /sales-workspaces/leads/:leadId/workflow`
- SDR and inside-sales frontend routes:
  - `/sales/sdr`
  - `/sales/inside-sales`
- shared lead-workspace workbench UI for qualification, handoff, and task creation
- seeded lead workspace option sets for outreach status, handoff status, and call disposition
- exhaustive Phase 11 validation script `tests/phase11-sales-workspaces-exhaustive.mjs`
- updated functional, API, sales-guide, README, and version documentation for the sales workspace rollout

- Phase 10 migration `20260617010000_phase10_sales_pipeline.sql`
- tenant-scoped `opportunities` and `opportunity_stakeholders` tables
- opportunity CRUD APIs with options, dashboard metrics, stage-aware updates, and tenant-safe stakeholder linkage
- opportunity frontend for:
  - list
  - detail
  - create and edit form
  - sales metrics cards
  - Kanban pipeline
  - stage distribution
  - permission-aware AI placeholders
- exhaustive Phase 10 validation script `tests/phase10-opportunities-exhaustive.mjs`
- opportunity coverage in functional, technical, API, and sales documentation

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

- platform metadata now reflects Phase 11: SDR and Inside Sales Workspace
- the dashboard now highlights SDR and inside-sales execution readiness alongside pipeline, campaign, and social modules
- sales-facing navigation now includes dedicated SDR and inside-sales workspace entries
- platform metadata now reflects Phase 10: Sales Pipeline and Opportunity Management
- tenant option sets and form-layout metadata now include opportunity sources, outcome statuses, and a default opportunity layout
- the shared CRM record engine now resolves `opportunity` against a live primary table instead of a future placeholder
- account detail guidance now points users to the live Opportunities workspace for account-linked revenue tracking
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

- sales workspace routes now enforce module-aware RBAC checks and assigned-lead visibility for non-manager roles
- owner reassignment from sales workspaces now remains assign-aware while workflow edits stay available to contributor roles with edit access
- workspace writes remain tenant-scoped and audit logged, including `lead.workspace.update` and `lead.handoff.update`
- opportunity routes now enforce module-aware RBAC checks
- opportunity owner updates enforce assign-aware authorization rules
- opportunity stage updates enforce approval and workflow-aware authorization rules
- opportunity writes remain tenant-scoped and audit logged, including stage-change audit events and timeline activities
- social routes now enforce module-aware RBAC checks
- social owner and campaign linkage updates enforce assign-aware authorization rules
- social approval updates enforce approval-aware authorization rules
- social post writes remain tenant-scoped and audit logged
- campaign routes now enforce module-aware RBAC checks
- campaign owner updates and member lifecycle mutations enforce assign-aware authorization rules
- campaign, campaign-member, note, activity, and task writes remain tenant-scoped and audit logged

### Notes

- email sequencing, meeting booking, MEDDIC execution, and AI-powered workspace actions remain placeholders in this phase
- products and services, forecast modeling, deal risk scoring, next-best-action logic, proposal drafting, and win probability remain placeholders in this phase
- social publishing, engagement ingestion, listening, competitor benchmarks, and social lead capture remain placeholders in this phase
- ticket and customer-success-account primary tables are still future work
- campaign performance analytics, attribution, and true scheduling remain placeholders in this phase
- the campaign foundation is now live and ready for later marketing automation, attribution, and AI Gateway integration
