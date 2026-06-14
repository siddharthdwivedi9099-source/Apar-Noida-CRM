# Module Catalog

## Purpose

This catalog defines the major modules expected in the platform, why each exists, how each should fit into the overall product, and what shared dependencies each module will rely on.

## Scope

This document includes:
- platform modules
- business modules
- AI platform modules
- module purpose and ownership direction
- dependencies and implementation notes

It does not include:
- detailed APIs
- schema definitions
- detailed screen inventories
- team staffing assignments

## Catalog Conventions

Each module entry should answer:
- what problem the module solves
- which primary users rely on it
- which shared platform capabilities it depends on
- which other modules it should integrate with

## Core Platform Modules

### Tenant Administration

- Purpose: tenant setup, configuration, lifecycle management, and governance
- Primary users: platform admins, tenant admins
- Key dependencies: identity, configuration, audit
- Implementation note: this module should own tenant-aware settings and lifecycle workflows

### Identity and Access

- Purpose: users, teams, roles, permissions, and policy enforcement
- Primary users: platform admins, tenant admins, security reviewers
- Key dependencies: audit, configuration
- Implementation note: identity and access is a platform capability, not a feature owned by a single business module

### Configuration Management

- Purpose: feature flags, settings, policy toggles, and tenant overrides
- Primary users: tenant admins, platform admins
- Key dependencies: tenant administration, audit
- Implementation note: configuration should be governed and version-aware

### Audit and Compliance

- Purpose: capture, store, and review sensitive and material platform activity
- Primary users: security reviewers, admins, auditors
- Key dependencies: all modules
- Implementation note: audit should be shared infrastructure with consistent event semantics

### Workflow Automation

- Purpose: execute cross-functional process rules, tasks, escalations, and orchestrations
- Primary users: operations teams, administrators
- Key dependencies: configuration, audit, notifications, domain events
- Implementation note: workflow logic should be modular and tenant-aware

### Dashboards and Reporting

- Purpose: provide operational, managerial, and executive insights
- Primary users: executives, managers, operations roles
- Key dependencies: analytics events, shared domain objects
- Implementation note: reporting should reflect trusted definitions rather than ad hoc metrics

## Revenue and Growth Modules

### Marketing

- Purpose: demand generation planning, audience operations, and outcome visibility
- Primary users: marketing managers, revenue operations
- Integrates with: campaigns, leads, dashboards
- Implementation note: marketing should align to downstream conversion context

### Social Media Marketing

- Purpose: support social publishing, engagement, and attribution workflows
- Primary users: social media managers, marketing managers
- Integrates with: marketing, campaigns, dashboards
- Implementation note: keep social workflows modular so they do not pollute CRM core models

### Campaign Management

- Purpose: define, run, and measure structured campaigns
- Primary users: marketing, SDR leadership, revenue operations
- Integrates with: marketing, leads, opportunities, reporting
- Implementation note: campaign lineage to pipeline should be traceable

### Inside Sales

- Purpose: support rapid response and early opportunity shaping
- Primary users: inside sales representatives
- Integrates with: leads, activities, opportunities
- Implementation note: inside sales should reuse shared lead and account context

### SDR

- Purpose: qualification, outreach, meeting generation, and handoff
- Primary users: SDR teams and managers
- Integrates with: campaigns, leads, sales, activity tracking
- Implementation note: qualification logic should be configurable and auditable

### Sales

- Purpose: manage opportunity progression and revenue outcomes
- Primary users: account executives, sales managers
- Integrates with: accounts, contacts, activities, presales, partner contribution, dashboards
- Implementation note: opportunity lifecycle should be strongly versioned and observable

### Business Development

- Purpose: support strategic account growth and opportunity creation
- Primary users: business development managers
- Integrates with: accounts, leads, opportunities, partners
- Implementation note: business development often overlaps sales but should keep its own workflow semantics

### Presales

- Purpose: support discovery, solution alignment, and technical validation
- Primary users: presales engineers, solution consultants
- Integrates with: opportunities, accounts, training, knowledge assets
- Implementation note: presales should maintain structured technical context rather than scattered notes

## Ecosystem and Customer Modules

### Partner Management

- Purpose: manage partner relationships, engagement, and performance
- Primary users: partner managers
- Integrates with: opportunities, onboarding, training, dashboards
- Implementation note: partner management should work across both pre-sales and post-sales lifecycles

### Reseller Management

- Purpose: handle reseller-specific operations and contribution tracking
- Primary users: reseller managers, channel operations
- Integrates with: partner management, opportunities, support, training
- Implementation note: reseller processes may require distinct onboarding and reporting paths

### Support Ticketing

- Purpose: issue intake, triage, escalation, and resolution
- Primary users: support agents, support managers
- Integrates with: accounts, contacts, success, onboarding, AI query handling
- Implementation note: support should preserve history and contribute signals to health and knowledge systems

### Customer Success

- Purpose: adoption, risk, renewal, and growth coordination
- Primary users: customer success managers, leadership
- Integrates with: onboarding, training, support, sales, dashboards
- Implementation note: customer success should synthesize lifecycle signals rather than become another isolated notes system

### Customer Onboarding

- Purpose: manage activation and implementation milestones
- Primary users: onboarding specialists, customer success managers
- Integrates with: training, support, success, accounts
- Implementation note: onboarding requires milestone structure and cross-functional visibility

### Customer Training

- Purpose: manage customer education programs, sessions, and readiness
- Primary users: training specialists, onboarding teams, success teams
- Integrates with: onboarding, success, knowledge management
- Implementation note: training outcomes should feed customer readiness and health signals

## AI Platform Modules

### AI Query Handling

- Purpose: manage inbound AI use cases in a governed flow
- Primary users: operational users, support teams, future customer-facing surfaces
- Integrates with: AI Gateway, RAG, prompt registry, agent registry
- Implementation note: query handling is a user-facing capability built on shared AI platform controls

### RAG Knowledge Assistant

- Purpose: enable retrieval-backed assistance over approved knowledge
- Primary users: support, success, onboarding, training, internal operators
- Integrates with: knowledge sources, AI Gateway, customer query flows
- Implementation note: authorization-aware retrieval is mandatory

### AI Gateway

- Purpose: centralized policy, routing, observability, and provider mediation
- Primary users: all AI-enabled modules
- Integrates with: prompts, agents, telemetry, model providers
- Implementation note: no feature should call models directly in production

### Prompt Registry

- Purpose: manage prompt assets as versioned governed artifacts
- Primary users: AI admins, platform teams
- Integrates with: AI Gateway, agents, evaluation workflows
- Implementation note: prompt version lineage must be preserved

### AI Agent Registry

- Purpose: register and govern AI agents and their tool permissions
- Primary users: AI admins, platform teams
- Integrates with: AI Gateway, workflows, evaluation systems
- Implementation note: agent rollout should support review and staged adoption

## Dependency and Sequencing Guidance

- Core platform modules must precede or accompany domain module implementation
- CRM kernel objects should be shared by revenue and service modules
- AI modules depend on strong identity, audit, and tenant controls
- Reporting depends on consistent object lineage and event definitions

## Phase Status

All modules in this catalog are currently **planned**. Phase 0 creates structure and documentation only.
