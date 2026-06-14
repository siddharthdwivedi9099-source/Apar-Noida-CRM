# AI-Native CRM Platform

## Purpose

This repository is the starting point for a production-ready, AI-native CRM platform intended to support the full customer lifecycle across demand generation, revenue operations, partner ecosystems, customer service, and customer success.

The goal is not to build a simple lead tracker. The target product is a multi-tenant operational system that combines:
- CRM system-of-record responsibilities
- AI system-of-intelligence capabilities
- workflow and automation system-of-action behavior

## Scope

This repository currently contains:
- the Phase 0 repository foundation
- documentation baseline for business, technical, security, AI, testing, and deployment planning
- release and versioning artifacts
- local development scaffolding only

It does not yet contain:
- application code
- service code
- authentication flows
- database implementation
- AI execution logic

## Current Phase

The repository is currently in **Phase 0: Foundation and Documentation Baseline**.

Phase 0 exists to remove ambiguity before implementation begins. It establishes the repository layout, documentation baseline, design direction, and release governance without introducing production code.

### Included in Phase 0

- Repository structure for applications, packages, docs, scripts, and tests
- Business, functional, technical, architecture, security, AI, testing, and deployment documentation
- Versioning, changelog, roadmap, and release note baseline
- Local environment template and Docker Compose development scaffold

### Explicitly Not Included in Phase 0

- Authentication and authorization implementation
- CRM business logic or module workflows
- AI execution logic, providers, or retrieval implementation
- Database schema, migrations, or persistence logic
- Frontend application code or API endpoints
- CI/CD pipelines or infrastructure automation code

## Product Intent

The platform is intended to support:
- Marketing and social media marketing
- Campaign management
- Inside sales and SDR workflows
- Sales, business development, and presales collaboration
- Partner and reseller management
- Support ticketing
- Customer onboarding, training, and success
- Dashboards and workflow automation
- AI query handling, RAG assistance, and governed AI operations

## Product Principles

- AI-native rather than AI-bolted-on
- Multi-tenant by design
- Secure and auditable by default
- Configurable without becoming ungovernable
- Modular with clear contracts
- Documentation-first from the beginning
- Production-minded before feature breadth

## Repository Structure

```text
apps/
  web/                Future operational frontend
  api/                Future API and orchestration entry point

packages/
  ui/                 Shared design system and UI primitives
  config/             Shared configuration contracts and helpers
  types/              Shared domain and platform types
  auth/               Reserved for future access and identity contracts
  ai/                 Reserved for future AI platform contracts
  database/           Reserved for future persistence contracts

docs/
  business/           Product vision, requirements, functional specs, role and module catalog
  technical/          Technical design and conceptual data model
  architecture/       System architecture and multi-tenancy design
  security/           Security design and RBAC baseline
  ai/                 AI architecture and governance documentation
  customer-success/   Success, training, and health design
  user-guides/        Reserved for future operational usage documentation
  testing/            Quality and validation strategy
  deployment/         Deployment and readiness guidance

scripts/              Reserved for future automation and developer workflows
tests/                Reserved for future automated test suites
```

## Documentation Map

### Product and Business

- [PRODUCT_VISION.md](docs/business/PRODUCT_VISION.md)
- [BUSINESS_REQUIREMENTS.md](docs/business/BUSINESS_REQUIREMENTS.md)
- [FUNCTIONAL_SPECIFICATION.md](docs/business/FUNCTIONAL_SPECIFICATION.md)
- [MODULE_CATALOG.md](docs/business/MODULE_CATALOG.md)
- [ROLE_CATALOG.md](docs/business/ROLE_CATALOG.md)

### Technical and Architecture

- [TECHNICAL_DESIGN.md](docs/technical/TECHNICAL_DESIGN.md)
- [DATA_MODEL.md](docs/technical/DATA_MODEL.md)
- [ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md)
- [MULTI_TENANCY_DESIGN.md](docs/architecture/MULTI_TENANCY_DESIGN.md)

### Security and AI

- [SECURITY_DESIGN.md](docs/security/SECURITY_DESIGN.md)
- [RBAC_MATRIX.md](docs/security/RBAC_MATRIX.md)
- [AI_ARCHITECTURE.md](docs/ai/AI_ARCHITECTURE.md)
- [AI_GATEWAY_DESIGN.md](docs/ai/AI_GATEWAY_DESIGN.md)
- [AI_AGENT_REGISTRY.md](docs/ai/AI_AGENT_REGISTRY.md)
- [PROMPT_REGISTRY.md](docs/ai/PROMPT_REGISTRY.md)
- [RAG_ARCHITECTURE.md](docs/ai/RAG_ARCHITECTURE.md)
- [CUSTOMER_QUERY_AI_DESIGN.md](docs/ai/CUSTOMER_QUERY_AI_DESIGN.md)

### Customer Operations, Quality, and Delivery

- [CUSTOMER_SUCCESS_FUNCTIONAL_SPEC.md](docs/customer-success/CUSTOMER_SUCCESS_FUNCTIONAL_SPEC.md)
- [CUSTOMER_TRAINING_FUNCTIONAL_SPEC.md](docs/customer-success/CUSTOMER_TRAINING_FUNCTIONAL_SPEC.md)
- [CUSTOMER_HEALTH_SCORE_DESIGN.md](docs/customer-success/CUSTOMER_HEALTH_SCORE_DESIGN.md)
- [TESTING_STRATEGY.md](docs/testing/TESTING_STRATEGY.md)
- [DEPLOYMENT_GUIDE.md](docs/deployment/DEPLOYMENT_GUIDE.md)
- [PRODUCTION_READINESS_CHECKLIST.md](docs/deployment/PRODUCTION_READINESS_CHECKLIST.md)

## Working Model for Future Phases

### Phase 0

Define product direction, repository structure, architecture baseline, AI governance baseline, and operational documentation.

### Phase 1

Establish the platform foundation:
- workspace tooling
- shared contracts
- configuration conventions
- audit and observability scaffolding
- CI quality gates

### Later Phases

Progressively implement CRM core, revenue workflows, partner capabilities, post-sales capabilities, and AI runtime services on top of the documented foundation.

## Documentation Standards

All future implementation work should follow these rules:
- Every major feature must map to a documented business purpose
- Every architectural change should update the relevant technical and architecture docs
- Every security-sensitive change should update the security model or controls documentation
- Every AI-related change should define prompts, agent policies, evaluation expectations, and access boundaries
- Release documentation must stay current with delivered scope

## Environment Baseline

The repository includes:
- `.env.example` for local configuration conventions
- `docker-compose.yml` for future local dependency bring-up

These files are placeholders for development readiness and do not represent a production deployment.

## Recommended Immediate Next Step

After Phase 0, the next recommended step is **Phase 1: Platform Foundation**. That phase should wire the monorepo, build pipeline, shared package boundaries, documentation site, configuration contracts, and observability scaffolding before business module implementation begins.
