# Production Readiness Checklist

## Purpose

This checklist defines the minimum readiness expectations that should be satisfied before the platform or any significant module is promoted for production use.

## Scope

This document covers:
- product readiness
- architecture readiness
- security readiness
- operational readiness
- quality and AI readiness

This document does not replace:
- module-specific acceptance criteria
- incident response runbooks
- release notes or changelog entries

## Product and Documentation Readiness

- business scope is documented and approved
- module boundaries are documented
- user-facing behavior changes are documented
- changelog and release notes are current

## Architecture Readiness

- core architectural decisions are documented
- service dependencies are understood
- multi-tenancy controls are defined and implemented for the released scope
- data and event lineage for the released capability are understood

## Security Readiness

- threat model reviewed for the released capability
- access control behavior is implemented and validated
- secrets are externally managed
- audit logging exists for sensitive actions
- backup and restore expectations are defined and tested where relevant

## Reliability and Operations Readiness

- health checks are configured
- logs, metrics, and traces are observable
- alerts or operational review paths are defined
- rollback procedure is documented
- operational owners are clear

## Observability and Performance Readiness (Phase 29)

Reference: [OBSERVABILITY_GUIDE.md](./OBSERVABILITY_GUIDE.md) and
[PERFORMANCE_GUIDE.md](./PERFORMANCE_GUIDE.md).

- [ ] Liveness probe configured against `GET /api/v1/health` (or `/live`).
- [ ] Readiness probe configured against `GET /api/v1/ready` (expects 503 to drain traffic).
- [ ] Metrics endpoint `GET /api/v1/metrics` reachable by the scraper / dashboards.
- [ ] Structured JSON logs are shipped to a central aggregator and queryable by `requestId`.
- [ ] Log redaction verified — no secrets/tokens/passwords appear in shipped logs.
- [ ] Request, error, slow-query, AI-usage, and workflow-execution logs are flowing.
- [ ] `SLOW_QUERY_THRESHOLD_MS` is tuned for the environment and slow-query logs are reviewed.
- [ ] Major tables have indexes covering their filter + sort paths (Phase 29 migration applied).
- [ ] Pagination is bounded (capped `pageSize`) on all list endpoints.
- [ ] Dashboard caching strategy is configured; `DASHBOARD_CACHE_ENABLED`/TTL set when Redis is live.
- [ ] Background job monitor reviewed (`/observability/jobs`); worker runtime status understood.
- [ ] Alerting defined for readiness failures, error-rate spikes, and slow-query volume.

## Deployment and CI Readiness (Phase 30)

Reference: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) and [DEVOPS_GUIDE.md](./DEVOPS_GUIDE.md).

- [ ] `npm run typecheck`, `npm run build`, and `npm test` pass in CI.
- [ ] `docker compose config` passes and is reviewed for expected services, ports, and secrets.
- [ ] API image builds from `apps/api/Dockerfile` and runs as a non-root user.
- [ ] Web image builds from `apps/web/Dockerfile` and serves React Router deep links through nginx fallback.
- [ ] Container health checks are wired to `/api/v1/health` for API and `/` for web.
- [ ] `RUN_MIGRATIONS` and `RUN_SEED` policy is explicitly set per environment.
- [ ] Production secrets are injected by the deployment platform, not baked into images.
- [ ] `VITE_API_BASE_URL` is set correctly for the target environment before web image build.
- [ ] CI builds API and web images before merge or release.
- [ ] Image tags/digests and rollback procedure are documented for the release.
- [ ] Post-deploy smoke checks cover web load, login, `/api/v1/health`, `/api/v1/ready`, and `/api/v1/metrics`.

## Quality Readiness

- automated tests cover critical behaviors
- contract compatibility is validated
- known risks are documented
- documentation reflects current behavior

## AI Readiness

- prompts are versioned
- agent permissions are reviewed
- retrieval access control is enforced
- evaluation baselines exist for affected AI workflows
- unsafe or high-impact actions require stronger controls

## Governance and Compliance Readiness

- data retention expectations are defined
- sensitive data handling is documented
- tenant export and deletion rules are understood
- incident response path is documented

## Implementation Guidance

When future releases are prepared:
- treat this checklist as a release gate, not as optional advice
- adapt module-specific checklist supplements where needed
- record exceptions explicitly with owner and approval
- keep readiness criteria aligned with architecture, security, and AI governance documents

## Security Configuration Gate (2026-06-23 review)

Before promoting to production, confirm the following. The API now enforces the secret/cookie items automatically at startup when `NODE_ENV=production` (it refuses to boot otherwise):

- [ ] `JWT_ACCESS_TOKEN_SECRET` set to a unique, non-default value
- [ ] `JWT_REFRESH_TOKEN_SECRET` set to a unique, non-default value, different from the access secret
- [ ] `DEFAULT_ADMIN_PASSWORD` changed from the documented default (and rotated after first login)
- [ ] `AUTH_COOKIE_SECURE=true` and `AUTH_COOKIE_SAME_SITE` chosen for the deployment topology
- [ ] `API_CORS_ORIGIN` restricted to the real web origin(s)
- [ ] `API_TRUST_PROXY` set to a finite hop count (e.g. `1`) matching the load-balancer topology rather than the default `true` (avoids `X-Forwarded-For` spoofing; see SECURITY_REVIEW_REPORT M-2)
- [ ] Shared (Redis) rate-limit store configured if running multiple API replicas (see SECURITY_REVIEW_REPORT L-1)
- [ ] AI gateway rate-limit enforcement reviewed before enabling live providers (see AI_GOVERNANCE known gaps)

Reference: [../security/SECURITY_REVIEW_REPORT.md](../security/SECURITY_REVIEW_REPORT.md).

## Phase 0 Note

This checklist is intentionally forward-looking. The repository is not yet near production operation, but the readiness bar is being defined early.
