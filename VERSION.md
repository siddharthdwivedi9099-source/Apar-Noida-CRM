# Version

## Current Release Version

Latest documented release version: **v0.1.0**

## Current Repository State

The repository currently contains **completed Phase 1 initialization work** on `main`, including:
- a runnable frontend in `apps/web`
- a runnable backend API in `apps/api`
- initialized shared packages
- updated technical, architecture, testing, and DevOps documentation

This means:
- `v0.1.0` is still the latest formally documented release baseline
- Phase 1 implementation work is present in the repository and recorded in `CHANGELOG.md` under `Unreleased`
- the next formal release should be cut separately rather than silently assumed

## Why This Matters

The version file needs to distinguish between:
- the latest formal release state
- the current implemented repository state

At the moment, those are not the same thing:
- the latest formal release baseline is `v0.1.0`
- the repository has progressed beyond that baseline with completed Phase 1 initialization work

## Meaning of `v0.1.0`

- `0` means the platform is still pre-general-availability
- `1` means the first formal foundation baseline was established
- `0` means no patch release was issued on top of that baseline

In practical terms, `v0.1.0` refers to the original foundation-and-documentation release baseline, not the full current repository implementation state.

## Next Expected Release

When the current Phase 1 work is cut as a formal release, it should be versioned as the next minor release rather than treated as a patch to `v0.1.0`.

That is because Phase 1 added:
- runnable application code
- a versioned API surface
- local runtime workflows
- shared package initialization

## Scope of the Latest Formal Release

The latest formal release baseline (`v0.1.0`) covers:
- repository foundation
- documentation baseline
- release and roadmap conventions
- local environment scaffolding

It does not fully represent the current repository state anymore.

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
- runnable application foundations and platform surfaces

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

- Every formal release should have matching entries in `CHANGELOG.md` and `RELEASE_NOTES.md`
- Repository progress may appear in `Unreleased`, but should not be mistaken for a cut release
- Breaking changes should be called out explicitly, even before `v1.0.0`
- The next implementation phase is **Authentication and RBAC**, which is not yet implemented

## Future Implementation Guidance

When the next formal release is prepared, also define:
- build artifact version stamping
- package version synchronization rules
- migration versioning format
- API deprecation policy
- AI asset promotion workflow across environments
