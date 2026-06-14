# Production Readiness Checklist

## Purpose

This checklist defines the minimum readiness expectations that should be satisfied before the platform or any significant module is promoted for production use.

## Scope

This document covers:
- product readiness
- architecture readiness
- security readiness
- operational readiness
- quality and AI readiness

This document does not replace:
- module-specific acceptance criteria
- incident response runbooks
- release notes or changelog entries

## Product and Documentation Readiness

- business scope is documented and approved
- module boundaries are documented
- user-facing behavior changes are documented
- changelog and release notes are current

## Architecture Readiness

- core architectural decisions are documented
- service dependencies are understood
- multi-tenancy controls are defined and implemented for the released scope
- data and event lineage for the released capability are understood

## Security Readiness

- threat model reviewed for the released capability
- access control behavior is implemented and validated
- secrets are externally managed
- audit logging exists for sensitive actions
- backup and restore expectations are defined and tested where relevant

## Reliability and Operations Readiness

- health checks are configured
- logs, metrics, and traces are observable
- alerts or operational review paths are defined
- rollback procedure is documented
- operational owners are clear

## Quality Readiness

- automated tests cover critical behaviors
- contract compatibility is validated
- known risks are documented
- documentation reflects current behavior

## AI Readiness

- prompts are versioned
- agent permissions are reviewed
- retrieval access control is enforced
- evaluation baselines exist for affected AI workflows
- unsafe or high-impact actions require stronger controls

## Governance and Compliance Readiness

- data retention expectations are defined
- sensitive data handling is documented
- tenant export and deletion rules are understood
- incident response path is documented

## Implementation Guidance

When future releases are prepared:
- treat this checklist as a release gate, not as optional advice
- adapt module-specific checklist supplements where needed
- record exceptions explicitly with owner and approval
- keep readiness criteria aligned with architecture, security, and AI governance documents

## Phase 0 Note

This checklist is intentionally forward-looking. The repository is not yet near production operation, but the readiness bar is being defined early.
