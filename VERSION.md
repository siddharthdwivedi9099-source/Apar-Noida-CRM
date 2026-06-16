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

This means:
- `v0.1.0` is still the latest formally documented release baseline
- the repository has progressed significantly beyond that baseline
- the next formal release should be cut separately rather than assumed automatically

## What Phase 7 Added

Phase 7 introduced:
- shared productivity schema for tasks and timeline events
- customer-facing note support and note editing
- richer activity logging with owner and outcome tracking
- task creation, assignment, and status tracking
- unified timeline responses and filterable frontend timeline views
- updated technical, functional, and user documentation for the shared productivity layer

## Versioning Guidance

- Major: breaking API or schema compatibility changes
- Minor: new backward-compatible module capabilities such as Phase 7
- Patch: bug fixes, non-breaking refinements, and documentation corrections
