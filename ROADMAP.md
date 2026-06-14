# Roadmap

## Purpose

This roadmap translates the product vision into phased delivery. It is intended to keep implementation ordered, reduce architectural risk, and ensure that platform concerns are solved before high-volume feature development begins.

## Scope

This roadmap provides:
- phased delivery direction
- sequencing guidance
- milestone objectives and exit criteria

It does not replace:
- sprint plans
- issue tracking
- detailed technical execution breakdowns

## Planning Principles

- Build shared foundations before module proliferation
- Establish tenancy, observability, and security early
- Treat AI governance as a platform concern, not a late add-on
- Deliver in vertical slices only after cross-cutting foundations are in place
- Keep documentation current with each phase

## Phase 0: Foundation and Documentation

### Objective

Create the repository foundation and design baseline for the platform.

### Deliverables

- Repository structure
- Core product and technical documentation
- AI and security baseline documentation
- Release, versioning, and roadmap artifacts
- Local environment scaffolding

### Exit Criteria

- Scope, architecture, and principles are documented
- Future implementation work has a consistent reference baseline
- No accidental code implementation is mixed into the foundation phase

## Phase 1: Platform Foundation

### Objective

Establish the shared engineering substrate that all future modules will use.

### Deliverables

- Monorepo tooling and workspace configuration
- Linting, formatting, and testing baseline
- CI quality gate definitions
- Shared configuration and type contracts
- Observability and audit scaffolding
- Tenant-context and module-boundary conventions

### Exit Criteria

- Contributors can build on a consistent platform skeleton
- Shared packages and runtime conventions are defined
- Delivery quality gates are enforceable

## Phase 2: CRM Core

### Objective

Create the minimal CRM kernel used by most business modules.

### Deliverables

- Accounts, contacts, leads, activities, notes, and opportunity foundations
- Timeline and search patterns
- Tenant-aware API and UI skeletons for core object handling

### Exit Criteria

- The platform can represent core commercial records
- Downstream modules can extend shared CRM objects rather than re-creating them

## Phase 3: Revenue Workflows

### Objective

Implement pre-sales and pipeline-driving workflows.

### Deliverables

- Marketing and campaign management
- Inside sales and SDR workflows
- Sales opportunity management
- Business development support
- Presales collaboration patterns

### Exit Criteria

- Teams can move prospects from campaign response through qualified pipeline progression

## Phase 4: Partner and Channel

### Objective

Add ecosystem and channel-operating capabilities.

### Deliverables

- Partner lifecycle management
- Reseller management
- Channel attribution and collaboration workflows

### Exit Criteria

- Partner-sourced and reseller-driven business can be managed in-platform

## Phase 5: Post-Sales Lifecycle

### Objective

Implement delivery, retention, and customer growth workflows.

### Deliverables

- Support ticketing
- Customer onboarding
- Customer training
- Customer success planning
- Health scoring foundations

### Exit Criteria

- The platform can support the post-sales operating lifecycle with shared context

## Phase 6: AI-Native Platform

### Objective

Turn the platform into a governed AI-native operating system.

### Deliverables

- AI Gateway
- Prompt Registry
- Agent Registry
- RAG knowledge assistant
- Customer query AI
- AI evaluation and governance workflows

### Exit Criteria

- AI behavior is routed, versioned, observable, and policy-governed

## Phase 7: Production Hardening

### Objective

Prepare the platform for real-world scale, operational resilience, and release discipline.

### Deliverables

- Performance tuning
- security validation
- disaster recovery readiness
- compliance readiness
- operational runbooks and GA checklist completion

### Exit Criteria

- The product can be promoted with confidence into production use

## Dependency Notes

- Phase 1 must be complete before major module implementation begins
- Phase 6 depends on both platform and domain context being stable enough to support governed AI execution
- Production hardening is continuous, but Phase 7 is where the formal release readiness bar is enforced
