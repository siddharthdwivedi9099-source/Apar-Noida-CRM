# Prompt Registry

## Purpose

This document defines how prompts should be stored, versioned, reviewed, and promoted within the platform.

## Scope

This document covers:
- the role of the prompt registry
- required prompt metadata
- prompt lifecycle and versioning
- governance and evaluation expectations
- implementation guidance

This document does not cover:
- actual prompt content
- model provider configuration
- UI design for prompt editing

## Why the Registry Exists

The platform needs a prompt registry to:
- prevent untracked prompt drift
- enable safe iteration and rollback
- associate prompts with owners and evaluations
- support tenant-level controlled variation
- keep prompt behavior reviewable over time

## Prompt Definition Model

Every prompt should have:
- prompt identifier
- version
- owner
- intended use case
- input contract
- output expectations
- safety notes
- model or routing hints
- lifecycle status
- evaluation references

## Lifecycle States

### Draft

Under development and not available for production selection.

### Reviewed

Checked for quality, fit, and policy alignment.

### Approved

Available for controlled production use.

### Deprecated

Still traceable but not preferred for new use.

### Archived

Retained for historical reference only.

## Versioning Rules

- content changes require a new version
- breaking input or output expectations require a major version change
- metadata changes should remain auditable even if content is unchanged
- tenant overrides should preserve lineage to an approved base prompt

## Governance Expectations

- prompts should be referenced by identifier and version, not copied inline
- production prompt changes should have review and evaluation evidence
- rollout of changed prompts should support safe comparison and rollback
- prompt history should remain available for audit and incident analysis

## Implementation Guidance

When implementation begins:
- define prompt storage and resolution contracts before editing experiences
- keep prompt ownership explicit
- link prompts to AI Gateway usage records
- support future validation of prompt variables and expected output structure
- treat prompt changes as production-affecting changes when they alter behavior materially

## Phase 0 Note

The registry is not yet implemented. This document establishes how it should behave when introduced.
