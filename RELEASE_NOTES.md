# Release Notes

## v1.0.0 - Production Release Baseline

Release date: **2026-06-20**

### Release Theme

`v1.0.0` establishes the AI-native CRM as a controlled production release baseline. It brings together the platform foundation, multi-tenant security model, core CRM modules, revenue operations workflows, customer success/training capabilities, AI governance foundation, dashboards, workflow automation, auditability, deployment packaging, and release-readiness documentation.

### Who This Release Is For

- CRM admins configuring tenants, roles, modules, terminology, themes, and governance.
- Sales, SDR, inside-sales, marketing, partner, reseller, support, customer-success, and training teams working inside the authenticated CRM.
- Customer users accessing the customer portal for tickets, knowledge, Ask AI, training, and profile/feedback flows.
- Operators preparing the platform for controlled production deployment.

### Major Capabilities Included

- Authentication with JWT access tokens, refresh-token rotation, secure password hashing, session tracking, login audit logs, failed-login handling, and rate limiting.
- Configurable RBAC with seeded role templates, permission catalog, role CRUD, role assignment, permission middleware, and permission-aware frontend navigation.
- Tenant-aware foundation with tenant settings, module toggles, terminology, theme configuration, custom-field metadata, form-layout metadata, option sets, pipeline stages, ticket statuses, and customer-success stages.
- Core CRM for leads, accounts, contacts, notes, tasks, activities, shared timeline, soft deletes, search, filtering, sorting, validation, RBAC, tenant isolation, and audit logs.
- Campaign, social media marketing, opportunity pipeline, SDR/inside-sales, business-development, partner, reseller, support, customer-success, and training workspaces.
- AI platform foundation with AI Gateway, Prompt Registry, AI Agent Registry, RAG knowledge foundation, Customer AI query bot, module AI actions, governance docs, audit logs, and approval controls for sensitive AI actions.
- Dashboards with role-based catalog visibility, live CRM metrics, drilldowns, saved views, exports, and dashboard cache seams.
- Workflow engine, notifications, approval workflows, and customer portal.
- Observability and deployment readiness: health, liveness, readiness, metrics, structured logging, slow-query logging, Docker images, Docker Compose stack, CI workflow, and deployment guidance.

### Security and Governance Highlights

- Tenant-scoped data access is a first-class design and implementation pattern.
- Authenticated APIs use JWT identity and permission checks.
- Sensitive writes and exports are audited.
- Refresh tokens are hashed in storage and rotated.
- AI calls route through a governed gateway instead of directly through modules.
- RAG and Customer AI retrieval use tenant-aware, permission-aware, approved-knowledge constraints.

### Testing and Validation

Validated release gates include:

- `npm run typecheck`
- `npm run build`
- `npm test`
- `npm run test:release`
- `node tests/phase30-deployment-devops-exhaustive.mjs`
- Docker Compose config/build/runtime smoke checks from the Phase 30 release gate

The repository also includes phase-specific live exhaustive scripts and offline Vitest suites for backend, frontend, and contract coverage.

### Deployment Notes

Use `docs/deployment/DEPLOYMENT_GUIDE.md` and `docs/deployment/DEVOPS_GUIDE.md` as the deployment source of truth. Production deployment should inject secrets from the target platform, run migrations intentionally, preserve immutable image tags or digests, and run smoke checks against web load, login, `/api/v1/health`, `/api/v1/ready`, and `/api/v1/metrics`.

### Known Limitations

Known limitations are documented in `KNOWN_LIMITATIONS.md`. The most important items are live external AI provider execution, production registry publishing, environment-specific deployment automation, full worker execution, Redis-backed dashboard cache serving, MFA/SSO, password reset, and advanced record/field-level authorization.

### Recommended Next Step

Run a staging release rehearsal using production-like secrets and datasets, then follow `POST_RELEASE_ROADMAP.md` for the first post-v1.0.0 hardening wave.
