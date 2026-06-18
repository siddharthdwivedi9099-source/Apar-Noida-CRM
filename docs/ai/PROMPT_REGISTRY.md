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

## Phase 19 Implementation

The prompt registry is implemented as of Phase 19.

### Data model

- **`ai_prompts`** — one row per prompt per tenant (unique on `(tenant_id, prompt_key)` where not deleted). Columns: `prompt_key`, `name`, `description`, `module`, `prompt_role` (`system`/`user`/`assistant`/`tool`), `input_schema`, `output_schema`, `guardrails`, `approval_status` (`draft`/`pending_review`/`approved`/`rejected`), `is_active`, `current_version`, `latest_version`, `created_by`, `updated_by`, audit/soft-delete columns.
- **`ai_prompt_versions`** — immutable version snapshots (unique on `(tenant_id, prompt_id, version)`). Columns: `version`, `content`, `input_schema`, `output_schema`, `guardrails`, `change_summary`, `approval_status`, `is_active`, `created_by`.

### Lifecycle (implemented)

1. **Create** (`POST /ai/prompts`) — creates the prompt plus version 1 in `draft`, inactive.
2. **Edit metadata** (`PATCH /ai/prompts/:promptId`) — name, description, module, role.
3. **Version** (`POST /ai/prompts/:promptId/versions`) — adds a new immutable version; optional `activate: true` repoints `current_version` and resets approval to `draft`.
4. **Activate a version** (`POST /ai/prompts/:promptId/versions/:version/activate`).
5. **Approve** (`POST /ai/prompts/:promptId/approval`).
6. **Activate / deactivate the prompt** (`POST /ai/prompts/:promptId/active`) — activation requires `approval_status = approved`, else `AI_PROMPT_NOT_APPROVED` (400).

### Permissions

| Action | Permissions (any of) |
| --- | --- |
| Read | any `ai.*` |
| Create | `ai.create`, `ai.configure`, `ai.manage_ai` |
| Edit / version | `ai.edit`, `ai.configure`, `ai.manage_ai` |
| Activate version / prompt | `ai.configure`, `ai.manage_ai` |
| Approve | `ai.approve`, `ai.configure`, `ai.manage_ai` |

### Frontend

The **Prompt Registry** admin screen (`/ai-prompts`) lists prompts and provides a prompt detail and version view: active content, guardrails, approval controls, activation, new-version authoring, and the full version history with per-version activation. See [../technical/API_DOCUMENTATION.md](../technical/API_DOCUMENTATION.md) for request/response shapes.
