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
- Phase 11: SDR and inside sales workspace

This means:
- `v0.1.0` is still the latest formally documented release baseline
- the repository has progressed significantly beyond that baseline
- the next formal release should be cut separately rather than assumed automatically

## What Phase 11 Added

Phase 11 introduced:
- SDR and inside-sales workspace routes and navigation
- sales-workspace APIs for queue reads and lead workflow updates
- seeded outreach status, handoff status, and call disposition catalogs
- lead-metadata-based qualification state for BANT, custom fields, and handoff progress
- call-task and follow-up-task creation directly from sales workspace UIs
- updated technical, functional, README, version, and sales documentation for the live workspace rollout

## Versioning Guidance

- Major: breaking API or schema compatibility changes
- Minor: new backward-compatible module capabilities such as Phase 11
- Patch: bug fixes, non-breaking refinements, and documentation corrections
