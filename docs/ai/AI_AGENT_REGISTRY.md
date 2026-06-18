# AI Agent Registry

## Purpose

This document defines how AI agents should be described, versioned, reviewed, and governed before they are allowed to operate in the platform.

## Scope

This document covers:
- the definition of an agent
- required agent metadata
- lifecycle and approval flow
- runtime and security expectations
- implementation guidance

This document does not cover:
- agent runtime code
- provider-specific reasoning strategies
- detailed tool APIs

## What an Agent Means in This Platform

An agent is a named AI actor with:
- a defined purpose
- a stable identity
- approved prompts or workflows
- allowed tools
- policy constraints
- evaluation and rollout expectations

Agents are not free-form dynamic constructs in production. They must be registered and governed.

## Required Agent Metadata

Every agent definition should capture:
- agent identifier
- version
- owner
- purpose
- supported use cases
- tenant scope
- allowed tools and tool policies
- prompt references
- model routing preferences
- safety classification
- review requirements
- evaluation references

## Agent Lifecycle

### Draft

The definition is being prepared and should not be available for production use.

### Reviewed

The definition has undergone technical and policy review but may not yet be approved for release.

### Approved

The definition is allowed for controlled production use under its declared policies.

### Deprecated

The definition should not be selected for new rollout, but history must remain available.

### Retired

The definition is no longer available for execution but remains historically traceable.

## Governance Rules

- agents must be registered before production use
- tool permissions must be explicit and minimal
- agents that can trigger actions should have stronger controls than read-only agents
- materially changed behavior requires re-review and re-evaluation
- historical versions must remain retrievable for audit and incident review

## Runtime Expectations

- execution must include tenant and actor context
- tool invocations must be attributable
- policy decisions must be traceable
- failures must be diagnosable without exposing restricted data

## Example Agent Categories

- customer query assistant
- support summarization assistant
- success plan review assistant
- knowledge curation assistant
- workflow triage assistant

## Implementation Guidance

When implementation begins:
- define the registry contract before implementing agent execution flows
- separate agent identity from prompt content so both can evolve independently
- treat tool permission review as a security review
- support staged rollout and rollback of agent versions
- store evaluation lineage alongside the registry metadata

## Phase 19 Implementation

The agent registry is implemented as of Phase 19.

### Data model — `ai_agents`

One row per agent per tenant (unique on `(tenant_id, agent_key)` where not deleted):

| Column | Notes |
| --- | --- |
| `agent_key` | Stable slug (lowercased). |
| `name`, `purpose` | Human-facing metadata. |
| `module` | Owning CRM module. |
| `allowed_tools` | JSON array of tool identifiers the agent may use. |
| `allowed_roles` | JSON array of user roles the agent serves. |
| `data_access_scope` | `own` \| `team` \| `module` \| `tenant`. |
| `requires_human_approval` | Whether actions need human approval. |
| `status` | `draft` \| `active` \| `inactive`. |
| `logging_enabled` | Whether agent activity is logged. |
| `escalation_rules` | JSON array of `{ trigger, action, escalateTo }`. |
| `is_system` | True for the seeded baseline agents. |
| `created_by`, `updated_by` | Authorship for audit. |

### Baseline agents

Sixteen baseline agents are provisioned per tenant on first read of the registry and flagged `is_system = true` (operator reconfiguration is preserved; they are never overwritten):

1. Sales Copilot Agent
2. Marketing Copilot Agent
3. Social Media Agent
4. SDR Assistant Agent
5. Presales Proposal Agent
6. Support Resolution Agent
7. Customer Success Onboarding Agent
8. Customer Success Scaled Agent
9. Customer Success Enterprise Agent
10. Customer Training Agent
11. Customer Query Resolution Agent
12. Partner Manager Agent
13. Reseller Growth Agent
14. Executive Insight Agent
15. Data Quality Agent
16. Workflow Automation Agent

### API and permissions

- `GET /ai/agents` (read; seeds baseline) — any `ai.*`.
- `GET /ai/agents/:agentId` (read) — any `ai.*`.
- `POST /ai/agents` (create custom agent) — `ai.create`/`ai.configure`/`ai.manage_ai`.
- `PATCH /ai/agents/:agentId` (configure) — `ai.edit`/`ai.configure`/`ai.manage_ai`.

Agents and prompts are tenant-scoped; cross-tenant access is not possible.

### Frontend

The **Agent Registry** admin screen (`/ai-agents`) lists agents and provides an agent detail view: purpose, allowed tools and roles, data-access scope, approval and logging flags, escalation rules, and inline configuration (status, scope, approval, logging). See [../technical/API_DOCUMENTATION.md](../technical/API_DOCUMENTATION.md) for request/response shapes.
