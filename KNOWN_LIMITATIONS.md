# Known Limitations

## v1.0.0 Limitation Register

This document records accepted limitations for the v1.0.0 production baseline. These items do not block the controlled release, but they must be understood before broad external rollout.

## Identity and Access

- Public self-signup is intentionally not implemented.
- Admin-created user lifecycle UI is not complete; users are still bootstrapped through seeds or future admin workflows.
- Password reset, MFA, SSO, SCIM, and enterprise identity federation are deferred.
- Field-level authorization and advanced record-sharing rules are not implemented beyond tenant boundaries, module permissions, ownership scopes where present, and explicit service checks.

## CRM and Business Workflows

- Lead conversion remains a placeholder.
- Some AI-assisted recommendations, forecasts, scoring, CSAT, and automation suggestions are placeholders until live AI/provider execution and evaluation gates are enabled.
- Dynamic runtime rendering from custom-field and form-layout metadata is not complete across every form.
- Attachments and file workflows are foundation-ready but require production storage policy, malware scanning, and retention configuration before broad use.

## AI and Knowledge

- AI Gateway provider execution currently uses governed placeholder/deferred responses unless production provider credentials and execution backends are enabled later.
- Embedding generation and vector storage are foundation-ready but deferred.
- Customer AI answers are constrained to approved customer-visible knowledge, but production evaluation, red-team testing, and knowledge-refresh operations should be run before opening the bot to large customer volumes.
- Sensitive AI actions require human review patterns, but customer-specific policy tuning should happen before external launch.

## Operations and Infrastructure

- Redis-backed dashboard serving and background worker execution seams exist, but full production worker runtime is deferred.
- Image publishing, registry promotion, and environment-specific deployment automation are documented but not wired to a selected production registry/runtime.
- MinIO is available in local Compose; production object storage must be provisioned separately.
- Observability endpoints exist, but production dashboards, alert routing, and log shipping must be configured in the deployment platform.
- Automated dependency scanning and secret scanning should be enabled in GitHub/security tooling outside the application code.

## Testing and Quality

- Offline Vitest suites and phase-specific exhaustive scripts exist, but not every historical phase script is intended to be the permanent current-release CI gate.
- The release gate should be repeated in staging with production-like secrets, network topology, CORS origins, object storage, and synthetic tenant data.
- Browser/device matrix testing should be expanded before high-volume external rollout.
- The web production build currently reports a large JavaScript chunk warning; code-splitting is recommended after release.

## Documentation

- API documentation is written manually. Generated OpenAPI documentation is recommended post-release once route schemas stabilize.
- Some older phase-specific notes remain in historical documentation for context; the release artifacts and current module docs are the v1.0.0 source of truth.

## Acceptance

These limitations are accepted for v1.0.0 because the requested release criteria are met, the limitations are non-hidden, and the post-release roadmap identifies concrete follow-up work.
