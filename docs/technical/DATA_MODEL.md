# Data Model

## Purpose

This document defines the conceptual data model for the platform. It exists to align business language, record ownership, and future schema planning before database implementation begins.

## Scope

This document covers:
- conceptual entities
- major object groupings
- lifecycle and ownership expectations
- data modeling principles
- implementation guidance for future schema design

This document does not cover:
- physical schemas
- field lists for every entity
- indexes or storage engine specifics
- migration scripts

## Modeling Principles

### Tenant-Scoped by Default

Every business object should be tenant-scoped unless explicitly defined as a controlled global artifact.

### Shared Customer Context

Core customer and commercial entities should be reused across modules rather than recreated independently.

### Audit-Friendly History

Important changes should be reconstructable through audit events, status history, or append-style operational logs where appropriate.

### Role and AI Awareness

Entity access must support authorization and AI retrieval boundaries, not just CRUD behavior.

### Reporting Readiness

Data lineage should support downstream reporting, attribution, and historical analysis.

## Entity Domains

### Tenant and Governance Domain

#### Tenant

Represents the primary isolation boundary for data, configuration, access, and AI behavior.

#### User

Represents a human actor operating in one or more tenant contexts.

#### Team

Represents an organizational grouping used for ownership, reporting, routing, or permissions.

#### Role

Represents a reusable authorization template.

#### Permission

Represents an explicit action or access scope used by roles or policies.

#### Audit Event

Represents an immutable record of meaningful administrative, operational, or AI activity.

### Commercial Domain

#### Account

Represents an organization the tenant is engaging, selling to, supporting, or growing.

#### Contact

Represents an individual person associated with an account or other relationship.

#### Lead

Represents an early-stage prospect or inbound interest requiring qualification.

#### Campaign

Represents a coordinated marketing or outreach effort with measurable outcomes.

#### Activity

Represents an interaction such as a call, email, task, meeting, note, or timeline event.

#### Opportunity

Represents a qualified commercial motion with stage, owner, risk, and value semantics.

### Ecosystem Domain

#### Partner

Represents an external organization involved in collaboration, referrals, or channel motions.

#### Reseller

Represents a channel organization involved in reselling products or services.

### Service and Retention Domain

#### Ticket

Represents a support issue, request, or operational case.

#### Onboarding Plan

Represents a milestone-based implementation or activation plan for a customer.

#### Training Program

Represents a defined learning pathway, course collection, or enablement initiative.

#### Success Plan

Represents a structured customer success plan with goals, risks, actions, and outcomes.

#### Health Score Snapshot

Represents a recorded evaluation of customer health at a point in time.

### AI and Knowledge Domain

#### Prompt

Represents a versioned prompt asset used by AI workflows.

#### Agent

Represents a governed AI actor with purpose, tool permissions, and execution policy.

#### Knowledge Document

Represents an approved content source for retrieval and knowledge assistance.

#### Retrieval Chunk

Represents a segmented unit of content used in retrieval pipelines.

#### AI Request

Represents a tenant-scoped AI invocation entering the AI platform.

#### AI Interaction Log

Represents the auditable record of AI execution metadata, policies, routing, and outputs.

### Workflow and Platform Automation Domain

#### Workflow

Represents a reusable process definition.

#### Trigger

Represents an event or condition that initiates workflow behavior.

#### Task

Represents an action assigned to a human or system.

#### Notification

Represents a user-facing communication or alert event.

## Relationship Direction

### Shared Identity and Context

- accounts may have many contacts
- accounts may have many opportunities, tickets, onboarding plans, and success plans
- leads may convert into accounts, contacts, and opportunities
- activities may attach to multiple object types depending on lifecycle stage

### Cross-Module Signal Reuse

- tickets may contribute to health scores
- onboarding milestones may contribute to success and training readiness
- training completion may influence health and adoption signals
- opportunities may involve partners, resellers, and presales contributions

### AI Context Relationships

- prompts may be referenced by many AI workflows
- agents may reference prompts, policies, and tools
- knowledge documents generate retrieval chunks
- AI requests and logs should retain references to resolved prompt and agent versions where applicable

## Data Governance Considerations

- sensitive data classification should be supported at field or object level where needed
- AI-relevant content must carry enough metadata for access-aware retrieval
- deletion and retention policies should be defined per object family
- global reference data should be clearly separated from tenant data

## Implementation Guidance

When schema design begins:
- define canonical identifiers and lifecycle states for each entity family
- model history where business reviewability matters
- document ownership semantics for every cross-module relationship
- preserve tenant and authorization metadata in AI and knowledge entities
- avoid creating near-duplicate object types for adjacent teams when shared objects can suffice

## Phase 1 Follow-Up

The next phase should refine this conceptual model into:
- entity dictionaries
- lifecycle state diagrams
- ownership and inheritance rules
- retention policy mappings
- schema and migration conventions
