# Role Catalog

## Purpose

This catalog defines the primary operating roles expected across the platform. It is intended to anchor future authorization design, workflow ownership, dashboard design, and cross-functional module interactions.

## Scope

This document covers:
- role definitions
- role responsibilities
- expected module touchpoints
- implementation considerations for future authorization

This document does not define:
- final permission objects
- record-level policy logic
- tenant-specific custom roles

## Role Design Principles

- Roles represent business responsibility first, not just screen access
- Authorization should separate platform administration from tenant operations
- Specialized AI and security responsibilities should not be bundled into general admin roles
- Tenant-specific extensions are expected but must be governed by a clear policy model

## Administrative Roles

### Platform Administrator

- Primary responsibility: operate the platform, environments, and cross-tenant governance controls
- Typical module touchpoints: tenant administration, configuration, audit, deployment operations, AI governance oversight
- Implementation note: this role should be tightly controlled and heavily audited

### Tenant Administrator

- Primary responsibility: manage tenant settings, user assignments, role templates, and enabled capabilities
- Typical module touchpoints: tenant settings, user management, feature configuration, dashboards
- Implementation note: tenant admins should not implicitly gain unrestricted platform-level powers

### Security and Compliance Reviewer

- Primary responsibility: review audit events, access patterns, and policy adherence
- Typical module touchpoints: audit, security controls, administrative history, AI governance logs
- Implementation note: this role often needs visibility without operational mutation privileges

## Revenue Roles

### Marketing Manager

- Primary responsibility: plan campaigns, monitor performance, and coordinate handoff into revenue workflows
- Typical module touchpoints: marketing, campaign management, dashboards, lead lifecycle
- Implementation note: attribution visibility matters as much as asset creation

### Social Media Manager

- Primary responsibility: run social campaigns and engagement workflows
- Typical module touchpoints: social media marketing, campaigns, dashboards
- Implementation note: this role may need strong content and engagement visibility but limited commercial edit authority

### SDR

- Primary responsibility: qualify leads, run outreach, and generate qualified meetings or next steps
- Typical module touchpoints: leads, campaigns, activities, handoff workflows
- Implementation note: qualification and disposition changes should be traceable

### Inside Sales Representative

- Primary responsibility: advance early-stage pipeline and coordinated follow-up
- Typical module touchpoints: leads, opportunities, activities, dashboards
- Implementation note: this role should inherit strong activity management capabilities

### Account Executive

- Primary responsibility: manage opportunities and close commercial outcomes
- Typical module touchpoints: opportunities, accounts, activities, forecasts, partner collaboration
- Implementation note: stage progression and revenue-related updates should be auditable

### Business Development Manager

- Primary responsibility: create strategic pipeline and pursue new account or expansion motions
- Typical module touchpoints: accounts, leads, opportunities, partner engagement
- Implementation note: this role may require long-cycle visibility across multiple modules

### Presales Engineer

- Primary responsibility: support discovery, solution design, and technical validation
- Typical module touchpoints: opportunities, requirements notes, technical deliverables, knowledge assets
- Implementation note: presales often needs access to account context without broad administrative powers

## Ecosystem and Service Roles

### Partner Manager

- Primary responsibility: manage partner relationships, collaboration, and performance
- Typical module touchpoints: partner management, opportunities, onboarding, training
- Implementation note: channel attribution and partner-linked activity should remain visible

### Reseller Manager

- Primary responsibility: coordinate reseller enablement and pipeline contribution
- Typical module touchpoints: reseller management, partner programs, opportunities, training
- Implementation note: reseller workflows may need dedicated lifecycle states

### Support Agent

- Primary responsibility: manage ticket intake, triage, resolution, and escalation
- Typical module touchpoints: support ticketing, knowledge, AI query assistance, account context
- Implementation note: support roles require efficient access to customer context without broad commercial editing rights

### Support Manager

- Primary responsibility: oversee queues, SLA performance, escalations, and quality
- Typical module touchpoints: support dashboards, ticket routing, staffing views, escalations
- Implementation note: manager roles often need wider queue visibility and reporting controls

### Customer Success Manager

- Primary responsibility: drive adoption, manage risk, and coordinate renewals or growth
- Typical module touchpoints: success plans, health, onboarding, training, support, opportunities
- Implementation note: this role relies on cross-functional read access and selective execution rights

### Onboarding Specialist

- Primary responsibility: execute onboarding plans and milestone progression
- Typical module touchpoints: onboarding, training, support coordination, success handoffs
- Implementation note: onboarding roles require structured task and milestone execution capabilities

### Training Specialist

- Primary responsibility: deliver training programs, sessions, and readiness tracking
- Typical module touchpoints: training programs, knowledge assets, onboarding, customer success
- Implementation note: training roles should manage learning artifacts without overreaching into unrelated modules

## Specialist Roles

### AI Administrator

- Primary responsibility: manage prompts, agents, model policies, and AI governance settings
- Typical module touchpoints: AI Gateway policies, prompt registry, agent registry, evaluation reporting
- Implementation note: this role should be distinct from ordinary operational administration

### Knowledge Manager

- Primary responsibility: curate retrieval sources, quality, freshness, and structure
- Typical module touchpoints: RAG knowledge sources, support content, training content, AI query quality
- Implementation note: knowledge governance is operationally important for trustworthy AI responses

### Executive Viewer

- Primary responsibility: review dashboards, summaries, and strategic performance indicators
- Typical module touchpoints: dashboards, high-level reports, selected health and pipeline summaries
- Implementation note: this role is visibility-heavy and edit-light by design

## Implementation Guidance

When authorization is implemented:
- start with role templates aligned to this catalog
- separate module permissions from platform powers
- support future tenant-level role composition without uncontrolled privilege spread
- map each role to dashboards, workflows, and object scopes explicitly

## Relationship to RBAC Matrix

This document explains the business meaning of roles. The detailed access direction is captured in [RBAC_MATRIX.md](../security/RBAC_MATRIX.md). The two documents should remain synchronized as roles evolve.

## Canonical Seeded Role Templates

The sections above describe roles by business function. For reference, the seeded role templates are defined in `packages/types/src/rbac.ts`. The 2026-06-24 audit established the original 28-role baseline below; the persona access metadata phase expanded the catalog to 49 role templates, with 32 persona definitions mapping to either baseline roles or newer persona-specific role templates.

| Administrative | Marketing & Sales | Service & Ecosystem | Customer Success & Leadership |
|----------------|-------------------|---------------------|-------------------------------|
| Super Admin | Social Media Marketing Executive | Presales Executive | Customer Success Manager - Onboarding |
| CRM Admin | Social Media Marketing Manager | Presales Manager | Customer Success Manager - Scaled |
| Customer Portal User | Marketing Executive | Support Executive | Customer Success Manager - Enterprise |
| | Marketing Manager | Support Manager | Customer Success Head |
| | Inside Sales Executive | Partner Manager | Executive Leadership |
| | Inside Sales Manager | Reseller Manager | |
| | Sales Development Representative | | |
| | SDR Manager | | |
| | Business Development Executive | | |
| | Business Development Manager | | |
| | Sales Executive | | |
| | Sales Manager | | |
| | Sales Head | | |
| | Sales Leader | | |

Original baseline 28: Super Admin · CRM Admin · Customer Portal User · Social Media Marketing Executive · Social Media Marketing Manager · Marketing Executive · Marketing Manager · Inside Sales Executive · Inside Sales Manager · Sales Development Representative · SDR Manager · Business Development Executive · Business Development Manager · Sales Executive · Sales Manager · Sales Head · Sales Leader · Presales Executive · Presales Manager · Support Executive · Support Manager · Partner Manager · Reseller Manager · Customer Success Manager - Onboarding · Customer Success Manager - Scaled · Customer Success Manager - Enterprise · Customer Success Head · Executive Leadership.

Persona access additions include: Digital Marketing Executive · Campaign Manager · Marketing Operations / RevOps · Inside Sales Representative · Business Development Representative · Account Executive / Sales Executive · Enterprise Sales / Strategic Sales · Sales Head / Revenue Leader · Presales Consultant · Solution Architect · Proposal / Bid Manager · Commercial / Finance Approver · Legal / Contract Reviewer · Reseller / Partner Sales User · Support Agent L1 · Support Agent L2 · CRM Administrator · System Administrator · AI Governance Manager · Data Quality Manager · Executive / CEO / CXO.
