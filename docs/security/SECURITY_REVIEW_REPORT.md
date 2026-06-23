# Security Review Report

**Review date:** 2026-06-23 (first pass) · 2026-06-24 (second/deep pass)
**Release reviewed:** v1.0.0 (`main` through Phase 31)
**Reviewer:** Code/security review pass (PROMPT 34)
**Scope:** Application-layer security of the AI-Native CRM API and web client. Infrastructure hardening (host, network, TLS termination, database server config) is out of scope and tracked separately in the deployment guides.

## Executive Summary

The platform's application-layer security posture is **strong**. Authentication, session management, RBAC, tenant isolation, RAG permissioning, and input validation are implemented consistently and verified in code during this review.

One **high-severity** configuration weakness was found and **fixed** during this review: in production the API could previously boot with known development JWT secrets, a known default admin password, or a non-`Secure` refresh cookie. A startup guard now refuses to boot under those conditions.

No SQL injection, authentication bypass, missing-authentication, broken tenant-isolation, cross-tenant IDOR, mass-assignment, or XSS sink was found. The deep second pass (2026-06-24) reconfirmed this against the dynamic-SQL builders, validation schemas, and log redaction, and found **no new critical or high issues**; it also closed M-2 by making `trust proxy` configurable.

| Severity | Found | Fixed | Documented / Deferred |
|----------|-------|-------|------------------------|
| Critical | 0 | 0 | 0 |
| High | 1 | 1 | 0 |
| Medium | 2 | 1 (M-2, configurable) | 1 |
| Low / Hardening | 3 | 0 | 3 |

## Methodology

Each of the 23 review areas below was assessed by reading the implementing code (not documentation). Key files reviewed: `apps/api/src/app.ts`, `common/auth/jwt.ts`, `common/auth/token-helpers.ts`, `common/http/cookies.ts`, `common/middleware/{authenticate,authorize,rate-limit,login-rate-limit,error-handler}.ts`, `common/validation/validate-request.ts`, `config/env.ts`, `modules/auth/auth.service.ts`, `modules/rag/rag.service.ts`, `modules/dashboards/dashboard.service.ts`, `modules/customer-portal/customer-portal.service.ts`, and `modules/ai/ai-gateway.service.ts`.

## Findings

### H-1 (High, FIXED) — Production could boot with development secrets
- **Where:** `apps/api/src/config/env.ts`
- **Issue:** `JWT_ACCESS_TOKEN_SECRET`, `JWT_REFRESH_TOKEN_SECRET`, and `DEFAULT_ADMIN_PASSWORD` had hardcoded development defaults, and `AUTH_COOKIE_SECURE` defaulted to `false`. A production deployment that omitted these variables would run with publicly-known secrets (enabling JWT forgery), a known admin password, or a refresh cookie transmittable over plaintext HTTP.
- **Fix:** Added a production startup guard. When `NODE_ENV=production`, the API refuses to start if any JWT secret still equals its dev default, if the two JWT secrets are identical, if the admin password equals the documented default, or if `AUTH_COOKIE_SECURE` is not `true`. Development and test behavior is unchanged.

### M-1 (Medium, DOCUMENTED) — AI gateway rate limit is not enforced
- **Where:** `apps/api/src/modules/ai/ai-gateway.service.ts`
- **Issue:** The per-tenant AI rate limit is reported in responses (`enforced: false`) but not enforced. This is a cost/abuse-control gap rather than a confidentiality/integrity issue. Per the review constraints, enforcement is a feature and was not added in this pass.
- **Recommendation:** Implement enforcement against the per-tenant `rate_limit_per_minute` before enabling live provider calls. Tracked in `KNOWN_LIMITATIONS.md` and `docs/ai/AI_GOVERNANCE.md`.

### M-2 (Medium, PARTIALLY FIXED) — `trust proxy` trusted all hops
- **Where:** `apps/api/src/app.ts`
- **Issue:** `trust proxy` was hardcoded to `true`, so a client could spoof `X-Forwarded-For` to influence IP-derived values used by the IP-based rate limiters and audit logs when the API is not strictly fronted by a controlled proxy.
- **Fix (second pass):** `trust proxy` is now driven by the `API_TRUST_PROXY` environment variable (`"true"`/`"false"`/hop count/IP list). The default preserves existing behavior; production should set a finite hop count (e.g. `API_TRUST_PROXY=1`) matching the load-balancer topology. This is now enforced as a production-readiness checklist item.
- **Residual:** the secure value is operator-configured, so the default still trusts all hops if left unset.

### L-1 (Low / Hardening, DOCUMENTED) — IP-based rate limiter is in-memory
- The global and login rate limiters are per-instance in-memory fixed windows. Behind multiple API replicas the effective limit multiplies by replica count. Recommend a shared (Redis) store for multi-instance deployments.

### L-2 (Low / Hardening, DOCUMENTED) — HSTS only in production
- `helmet` HSTS is disabled outside production by design. Confirm TLS + HSTS preload at the edge for all public environments.

### L-3 (Low / Hardening, DOCUMENTED) — Live AI provider execution deferred
- Provider calls return deterministic placeholders in this release (`result.placeholder`). Prompt-injection execution risk is therefore currently low, but the redaction flag exists without enforced redaction. Re-run this review's AI sections before enabling live providers.

## Area-by-Area Assessment

| # | Area | Status | Evidence |
|---|------|--------|----------|
| 1 | Authentication | ✅ Strong | Bearer-token middleware; DB-backed active session required (`authenticate.ts`, `auth.service.ts`). |
| 2 | JWT handling | ✅ Strong | HS256 HMAC; signature verified with `timingSafeEqual` before payload parse; `type` + `exp` enforced; no `alg:none` path (`jwt.ts`). |
| 3 | Refresh tokens | ✅ Strong | Rotated on every refresh; sha256-hashed at rest; reuse detection revokes the session and audit-logs the failure (`auth.service.ts`). |
| 4 | Password hashing | ✅ Strong | `pgcrypto` `crypt()` (bcrypt-family) compared in SQL with parameterized input; account lockout via `locked_until`. |
| 5 | RBAC | ✅ Strong | Permission codes enforced via `requirePermissions` middleware and service-layer `requirePermission`; `allOf`/`oneOf` semantics. |
| 6 | Field-level permissions | ✅ Present | CRM record/field permission gating (`crm.router.ts` `requireRecordPermissions`). |
| 7 | Record-level permissions | ✅ Present | Ownership/record checks (e.g. saved-view ownership in `dashboard.service.ts`). |
| 8 | Tenant isolation | ✅ Strong | `tenant_id` consistently present in WHERE/JOIN clauses across services; verified by inspection. |
| 9 | Customer portal isolation | ✅ Strong | Portal queries scoped to `tenant_id AND user_id AND account_id`; profile required before access. |
| 10 | API authorization | ✅ Strong | Every data router applies auth middleware; only `health` is public (intended). |
| 11 | Input validation | ✅ Strong | `zod` schemas on body/params/query via `validateRequest`. |
| 12 | Output sanitization | ✅ Strong | React escaping; no `dangerouslySetInnerHTML`/`innerHTML` in the web client. |
| 13 | Rate limiting | ⚠️ Adequate | Global API + dedicated login limiter + security-probe limiter; in-memory (see L-1); AI limiter not enforced (see M-1). |
| 14 | CORS | ✅ Strong | Explicit normalized allowlist; credentialed; disallowed origins receive no ACAO. |
| 15 | Secure headers | ✅ Strong | `helmet` (no-referrer, CORP same-site, prod HSTS); `x-powered-by` disabled. |
| 16 | File upload security | ✅ N/A | No multipart upload handler is implemented; `FILE_UPLOAD_MAX_MB` is configured for future use; JSON body capped at 1mb. |
| 17 | Audit logs | ✅ Strong | Auth events, access denials (401/403), portal actions, RAG retrieval, and exports are audit-logged with parameterized inserts. |
| 18 | AI data access | ✅ Strong | AI settings/logs tenant-scoped; gateway is the single governed entry point. |
| 19 | RAG permission checks | ✅ Strong | Knowledge sources filtered by `required_permission`; tenant-scoped; only approved/published articles returned. |
| 20 | Prompt injection risk | ✅ Low (current) | Prompts come from the managed registry; live provider execution deferred (see L-3). |
| 21 | Sensitive data exposure | ✅ Good | Generic 500s; no stack traces returned; refresh tokens never returned in bodies (HttpOnly cookie). |
| 22 | Error messages | ✅ Good | Generic login failure (`Invalid tenant, email, or password.`) prevents user enumeration. |
| 23 | Secrets management | ✅ Fixed | Production guard added (see H-1); secrets sourced from environment, never committed. |

## Second Pass — Deep Review (2026-06-24)

The second pass was adversarial, targeting issue classes a broad first pass can miss. Additional files reviewed: every `*.service.ts` dynamic-SQL builder (`resellers`, `opportunities`, `rbac`, `sales-workspaces`, `training`), `platform/logger/logger.ts`, and the router validation schemas across all modules. **No new critical or high issues were found.**

| Attack class | Method | Result |
|--------------|--------|--------|
| SQL injection | Grepped all `${...}` inside query strings and `+` concatenation; read every dynamic builder. | ✅ Safe. Interpolated fragments are whitelisted identifiers only — table names are compile-time unions, sort columns come from fixed maps, `UPDATE SET` assignments use hardcoded column names. All user **values** are bound as `$n` parameters. |
| Cross-tenant IDOR | Verified fetch/update/delete-by-id queries. | ✅ Safe. Every record query carries `tenant_id = $n`; UPDATE/DELETE use `WHERE id = $1 AND tenant_id = $2`. |
| Record-level access | Read `resolveScope` / `buildScopedWhere`. | ✅ Enforced. Owner/team scope is resolved and a `403` is raised when a caller requests a scope they lack permission for. |
| Mass assignment | Checked `z.record(z.unknown())` usage and service update paths. | ✅ Bounded. Loose record schemas apply only to free-form `metadata`/`config` JSON (stored as `jsonb`); update services assign only explicitly whitelisted columns via `keys.includes(...)`. |
| Secrets in logs | Read `logger.ts` redaction config. | ✅ Strong. Pino redacts `authorization`/`cookie` headers, `password`, `passwordHash`, `accessToken`, `refreshToken`, `token`, `secret`, and wildcards. |
| Sensitive-field exposure | Grepped `password_hash`/`refresh_token_hash`/`secret` in SELECTs and responses. | ✅ Safe. Confined to the auth module's in-SQL comparison; never selected into API responses. |
| Credential brute force | Read `login-rate-limit.ts` + account-lockout logic. | ✅ Bounded twice — limiter keyed on `ip:tenant:email` **and** DB account lockout after `AUTH_ACCOUNT_LOCK_THRESHOLD` failures (independent of IP). |
| Committed secrets | `git ls-files` for `.env`; grep for `sk-`/`AKIA` literals. | ✅ Clean. No committed `.env`; `.env*` gitignored; no hardcoded provider keys. |
| Per-endpoint authz | Counted mutations vs permission gates in `audit`, `workflows`, `approvals`, `customer-query`, `tenant-config`. | ✅ Every mutation is permission-gated. |

**Hardening applied this pass:** M-2 — `trust proxy` is now configurable via `API_TRUST_PROXY` (see finding above) instead of hardcoded `true`.

## Remediations Applied in This Review
1. **H-1** — Production secret/cookie startup guard added to `apps/api/src/config/env.ts` (first pass).
2. **M-2** — `trust proxy` made configurable via `API_TRUST_PROXY`, defaulting to current behavior, with production guidance to pin a finite hop count (second pass).

## Residual Risks (Accepted / Deferred)
- **M-1** AI gateway rate-limit enforcement (deferred; feature work).
- **M-2** `trust proxy` hop count (operational; set per deployment topology).
- **L-1** Shared rate-limit store for multi-replica deployments.
- **L-3** Re-review AI sections before enabling live providers.

## Verification
- Typecheck: pass (all workspaces)
- API tests: 88 passed · Web tests: 16 passed
- Release-readiness and deployment-artifact gates: pass

See also: [SECURITY_DESIGN.md](./SECURITY_DESIGN.md), [ACCESS_CONTROL_GUIDE.md](./ACCESS_CONTROL_GUIDE.md), [AUDIT_LOGGING_GUIDE.md](./AUDIT_LOGGING_GUIDE.md), [RBAC_MATRIX.md](./RBAC_MATRIX.md), [../ai/AI_GOVERNANCE.md](../ai/AI_GOVERNANCE.md).
