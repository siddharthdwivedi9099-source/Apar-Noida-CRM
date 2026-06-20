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
- Phases 12-27: business development, partners, resellers, support, customer success, training, AI platform, dashboards, workflow automation, notifications, approvals, customer portal, and security/data governance
- Phase 28: automated testing framework and coverage
- Phase 29: observability, logging, metrics, cache seams, and performance readiness
- Phase 30: deployment, DevOps, Docker, and CI readiness

This means:
- `v0.1.0` is still the latest formally documented release baseline
- the repository has progressed significantly beyond that baseline
- the next formal release should be cut separately rather than assumed automatically

## What Phase 30 Added

Phase 30 introduced:
- production-style API and web Docker images
- full-stack Docker Compose topology for Postgres, Redis, MinIO, API, and web
- optional API startup migration/seed entrypoint controls
- GitHub Actions CI for install, typecheck, build, offline tests, and image build validation
- deployment, DevOps, and production readiness documentation updates
- an exhaustive Phase 30 validation script for deployment artifacts

## Versioning Guidance

- Major: breaking API or schema compatibility changes
- Minor: new backward-compatible module capabilities such as Phase 30
- Patch: bug fixes, non-breaking refinements, and documentation corrections
