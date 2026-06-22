# Post-Release Roadmap

## Purpose

This roadmap identifies the highest-value work after the v1.0.0 production baseline. It is intentionally focused on hardening, operational maturity, and the deferred execution backends documented in `KNOWN_LIMITATIONS.md`.

## Immediate Stabilization

- Run a staging release rehearsal with production-like secrets, CORS origins, object storage, Redis, and synthetic tenant data.
- Add production log shipping, metrics dashboards, and alert routing for health, readiness, error rate, slow queries, auth failures, workflow failures, AI usage, and audit exports.
- Enable GitHub dependency scanning, secret scanning, and branch protection checks.
- Create an incident response runbook and operational owner rotation.
- Add backup/restore rehearsal evidence for Postgres and object storage.

## First Hardening Wave

- Add admin-created user lifecycle management, invitation flow, password reset, and admin password rotation UI.
- Add MFA and prepare SSO/SCIM integration points.
- Expand field-level authorization, record-sharing rules, and audit visibility for sensitive CRM data.
- Complete dynamic custom-field/form-layout rendering across business forms.
- Add generated OpenAPI documentation and route schema publication.

## AI Execution and Governance

- Enable live AI provider execution behind the AI Gateway with tenant-level provider controls.
- Implement redaction pipeline, prompt evaluation baselines, and regression scoring.
- Add embedding generation, vector-store backend, and retrieval quality evaluation for RAG.
- Add customer-query bot red-team checks and customer-visible knowledge approval workflows.
- Wire sensitive AI actions to approval workflows with explicit reviewer SLAs.

## Workflow and Automation

- Activate production background workers for notifications, scheduled workflows, retention purge, embedding backfill, dashboard cache warmers, and SLA checks.
- Implement Redis-backed dashboard cache serving and invalidation.
- Add workflow simulation/testing tools for admins before activation.
- Add webhook retry policy, signing, and delivery logs.

## Product Expansion

- Implement lead conversion to account/contact/opportunity.
- Expand support attachments, CSAT, escalation playbooks, and knowledge article lifecycle.
- Expand customer success health automation, lifecycle playbooks, renewal forecasting, and usage ingestion.
- Expand partner/reseller enablement, certification, order tracking, and channel attribution.
- Add advanced reporting exports, scheduled reports, and dashboard sharing controls.

## Deployment and Release Automation

- Select production registry/runtime and implement image publishing.
- Add environment promotion workflows for staging and production.
- Add immutable image tagging, release approvals, rollback automation, and migration preflight checks.
- Add smoke-test automation after deployment.

## Quality Expansion

- Convert the most important live phase scripts into stable current-release E2E scenarios.
- Add browser automation for critical frontend workflows.
- Split the main web bundle with route-level or feature-level code splitting.
- Add performance baselines for list endpoints, dashboards, support queues, and AI/RAG flows.
- Add accessibility checks for admin, CRM, customer portal, and dashboard pages.

## Success Metrics

- Zero production secrets committed to source.
- All production deployments include CI, image build, migration status, smoke checks, and rollback reference.
- Auth/RBAC/tenant-isolation regressions are covered by automated tests.
- AI outputs are logged, attributable, evaluated, and approval-gated where sensitive.
- Customer-facing support, training, and Ask AI flows remain tenant/account isolated.
