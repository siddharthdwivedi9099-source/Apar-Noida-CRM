# Changelog

## [Unreleased]

Current repository state now includes Phase 1 through Phase 7 implementation work.

### Added

- Phase 7 migration `20260616170000_phase7_productivity_timeline.sql`
- tenant-scoped `crm_tasks` and `crm_timeline_events` tables
- expanded shared `crm_notes` support for customer-facing notes and note editing
- expanded shared `crm_activities` support for activity owner, outcome, richer activity types, and broader record links
- shared record APIs for:
  - timeline reads
  - note creation
  - note editing
  - activity creation
  - task list
  - task creation
  - task updates
- lead, account, and contact detail views for:
  - notes panel
  - activity panel
  - task list
  - filterable customer timeline
- new end-user guide for shared productivity workflows

### Changed

- platform metadata now reflects Phase 7: Activities, Tasks, Notes, and Customer Timeline
- lead, account, and contact detail pages now load owners plus shared productivity data together
- CRM detail summaries now surface task counts alongside notes and activities
- README, version notes, functional specification, data model, and API docs now reflect the Phase 7 capability set

### Security

- shared record productivity routes now enforce module-aware RBAC checks
- task updates now enforce assign-only mutation limits where appropriate
- note edits, activity creation, and task lifecycle writes are tenant-scoped and audit logged

### Notes

- dedicated opportunity, ticket, and customer-success-account primary tables are still future work
- shared productivity routes already support those record types as foundation-only references
- timeline foundation is live for notes, activities, tasks, and placeholder external event types
