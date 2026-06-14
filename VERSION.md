# Version

## Current Version

Current version: **v0.1.0**

## Purpose

This document defines how the platform version is interpreted and how versioning should work across application releases, contracts, AI assets, and operational artifacts.

## Meaning of `v0.1.0`

- `0` means the platform is pre-general-availability
- `1` means the first structured foundation release has been defined
- `0` means no patch release has been issued for this baseline yet

In practical terms, `v0.1.0` represents a documentation and repository-structure milestone rather than a software feature release.

## Scope of the Current Version

The current version covers:
- Repository foundation
- Documentation baseline
- Release and roadmap conventions
- Local environment scaffolding

The current version does not cover:
- Production application code
- APIs
- authentication
- database implementation
- AI execution features

## Semantic Versioning Policy

The platform will follow semantic versioning:

### Major

Increment the major version when introducing breaking changes to:
- public APIs
- shared contracts
- tenant configuration models
- AI registry contracts
- deployment expectations with compatibility impact

### Minor

Increment the minor version when adding backward-compatible capabilities such as:
- new modules
- new workflows
- new AI capabilities
- new operational tooling
- substantial documentation expansions aligned with delivered capabilities

### Patch

Increment the patch version when applying:
- bug fixes
- documentation corrections
- non-breaking quality improvements
- minor operational clarifications

## Additional Versioned Artifacts

The platform version is only one dimension. The following assets must also be versioned independently:

- API contracts
- event schemas
- database migration chains
- prompt definitions
- agent definitions
- tenant configuration bundles
- knowledge index revisions
- documentation baselines where needed for regulated releases

## Release Management Guidance

- Every release should have matching entries in `CHANGELOG.md` and `RELEASE_NOTES.md`
- Breaking changes should be called out explicitly, even before `v1.0.0`
- Pre-GA releases should still follow disciplined version increments to avoid ambiguity
- Feature branches and experimental work should not redefine version numbers outside release preparation

## Future Implementation Guidance

When code is introduced, the next release process should also define:
- build artifact version stamping
- package version synchronization rules
- migration versioning format
- API deprecation policy
- AI asset promotion workflow across environments
