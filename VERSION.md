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

This means:
- `v0.1.0` is still the latest formally documented release baseline
- the repository has progressed significantly beyond that baseline
- the next formal release should be cut separately rather than assumed automatically

## What Phase 6 Added

Phase 6 introduced:
- CRM schema for leads, accounts, contacts, notes, and activities
- CRM APIs with tenant isolation, RBAC checks, pagination, filters, and soft delete
- frontend CRM list, detail, create, and edit flows
- CRM audit logging
- updated technical and user documentation for the live CRM surface

## Versioning Guidance

- Major: breaking API or schema compatibility changes
- Minor: new backward-compatible module capabilities such as Phase 6
- Patch: bug fixes, non-breaking refinements, and documentation corrections
