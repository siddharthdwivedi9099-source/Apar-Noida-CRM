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

## Phase 0 Note

This document describes governance and design only. No agent registry exists in code yet.
