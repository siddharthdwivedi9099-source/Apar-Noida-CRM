# Version

## Current Release Version

Latest documented formal release: **v0.1.0**

## Current Repository State

The repository now contains completed implementation work through:

- Phase 1: runtime foundation
- Phase 2: database foundation
- Phase 3: authentication
- Phase 4: RBAC
- Phase 5: tenant configuration
- Phase 6: leads, accounts, and contacts CRM foundation
- Phase 7: activities, tasks, notes, and customer timeline
- Phase 8: campaign management and marketing foundation
- Phase 9: social media marketing module
- Phase 10: sales pipeline and opportunity management

This means:
- `v0.1.0` is still the latest formally documented release baseline
- the repository has progressed significantly beyond that baseline
- the next formal release should be cut separately rather than assumed automatically

## What Phase 10 Added

Phase 10 introduced:
- tenant-scoped `opportunities` and `opportunity_stakeholders` tables
- configurable pipeline stages, opportunity sources, and outcome statuses
- opportunity list, detail, create, edit, and soft-delete flows
- dashboard metrics for pipeline value, stage distribution, closing-this-month, and stalled deals
- Kanban pipeline interactions with audited stage movement
- sales-oriented AI placeholder actions for summaries, risks, next best action, proposal drafts, and win probability
- updated technical, functional, and sales documentation for the live opportunity workspace

## Versioning Guidance

- Major: breaking API or schema compatibility changes
- Minor: new backward-compatible module capabilities such as Phase 10
- Patch: bug fixes, non-breaking refinements, and documentation corrections
