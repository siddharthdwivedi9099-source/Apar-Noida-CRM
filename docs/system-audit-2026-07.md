# Full-System Audit — July 2026

A whole-system recheck across completeness, security, configurability, workflow
authoring, AI usability, integration readiness, code quality, DevOps, UI, and
Azure/scale readiness. Every claim below was verified against the live stack
(docker compose, API on :4000, web on :5173) or the repository at the audited
commit — not assumed.

## 1. User-story completeness

- **Personas 6–32 (27 personas):** every persona has an explicit "now complete"
  delivered entry in `docs/crm-configuration-roadmap.md`, pure unit-tested
  resolvers in `@crm/types`, service + router implementations, isolated web
  panels, and idempotent configuration seeds. Spot-verified live this audit.
- **Personas 1–5 (marketing cluster, SM/DM/MM/CM/MOPS — 25 stories):** the
  capabilities exist and pass their exhaustive suites (social module with
  content calendar/channels/approvals, campaigns with members + segmentation +
  `campaign_approval` type, MQL rule configuration enforced in
  `createLead`/`updateLead`, lead scoring models, assignment/routing rules,
  duplicate detection, nurture sequences, funnel dashboards). DM-001…004 are
  explicitly tracked; the remaining stories are covered by module phases but
  lack a story-by-story delivered mapping. **Recommendation:** add an explicit
  SM/MM/CM/MOPS acceptance mapping the way Personas 6–32 have.
- **Master-spec sections 12–16** (30 workflow automations, 15 validation rules,
  30 notifications, 14 role-access expectations, configuration dimensions +
  10 revenue journeys): delivered, seeded as governed configuration, and
  live-verified in the phase rechecks recorded in the roadmap.

## 2. Security

Verified live and in code:

- **AuthN/AuthZ:** JWT access (15 min) + refresh (30 d) with separate secrets; a
  production boot guard refuses dev-default secrets. Refresh tokens stored
  hashed with constant-time comparison; sessions in `auth_sessions` (DB-backed
  → stateless API). Passwords hashed via pgcrypto `crypt()`.
- **RBAC:** permission catalog (module × action), ~50 role templates, record
  scoping (mine/team/all) enforced service-side. Live probe this audit:
  `sales.executive` sees only own records; `scope=all` → 403. The 14-role
  access contract is machine-checked in CI (`role-access-expectations`).
- **Transport/middleware:** helmet CSP + nosniff + frame protection, CORS
  allowlist, global + per-login rate limiting (429 with Retry-After), 1 MB body
  limit, `trust proxy` configurable. **Fixed this audit:** the web nginx now
  also sends `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  and `Permissions-Policy` (previously bare).
- **SQL:** all queries parameterized; dynamic SQL identifiers only ever come
  from code-level allowlist constants (verified `cross-functional`, `training`,
  `workflows`, `rag`, `system`). No hard `DELETE`s — soft deletes everywhere.
  Structured error envelope; no stack traces leaked (live-verified).
- **Secrets:** only `.env.example` in git; no hardcoded credentials found.
- **AI governance:** sensitive AI actions require human approval
  (`sensitive_ai_action_approval`), all AI calls go through the gateway with
  confidence + explanation + audit logging, redaction + rate limits per tenant.
- **Recommendations (not blockers):** HSTS at the TLS-terminating ingress in
  production; move rate limiting to Redis when scaling beyond one API replica;
  add dependency scanning (e.g. `npm audit` / Dependabot) to CI.

## 3. Configurability

Everything the spec calls configurable is configuration, not code: option sets
(stages, statuses, sources, channels, reasons, scripts, checklists), custom
fields + form layouts, terminology, modules on/off, theme, scoring/MQL/routing/
SLA policies, BPFs, workflow automations, validation rules, notification rules,
role templates, journeys, configuration dimensions, telephony (new — see § 5).
All seeded idempotently via `configuration_definitions` with checksums, and
editable from the Admin UI (option sets, custom fields, RBAC, workflows,
settings, theme, terminology).

## 4. Workflow authoring & AI usability

- **Admin can build a workflow end-to-end from the UI** (`/workflows`): pick a
  trigger from the governed catalog, add optional conditions
  (field/operator/value, multi-operator AND verified live), attach typed
  actions (tasks, notifications, approvals, field updates, AI prompt/agent via
  the gateway), run it, and inspect run logs including per-action failures
  (SAVEPOINT-isolated). Phase-24 exhaustive suite passed live this audit.
  **Recommendation:** replace the raw-JSON action config textarea with guided
  per-action forms for friendlier authoring.
- **AI usability:** Ask-AI + AI Assistant pages, prompt/agent registries,
  AI actions queue with approvals, governance console, RAG knowledge console.
  All AI output includes confidence + explanation + audit trail; sensitive
  actions gate on human review.

## 5. Integration readiness

- **Telephony / IVR / mobile (click-to-call) — DELIVERED this audit.** Phone
  numbers across leads/contacts (lists + detail pages) are now dialable links
  driven by a new tenant setting `settings.telephony`: protocol `tel:`
  (device/mobile dialer), `callto:` (Teams/Skype), `sip:` (softphones/IVR
  bridges), or a **custom dialer URL template** with `{number}` substitution —
  configurable in Admin → Workspace settings, validated server-side, unit
  tested (`buildClickToCallHref`, 6 tests).
- **Email:** email addresses render as `mailto:` links (opens Outlook/Gmail/
  any default client). Notification engine models an `email` channel with
  per-recipient `notification_deliveries`; **outbound SMTP/Graph/Gmail-API
  delivery adapter is not yet implemented** (in-app delivery is). That adapter
  is the single missing piece for true email-out.
- **Social (LinkedIn/YouTube/WhatsApp/Instagram/FB):** channels are governed
  option sets; the social module plans/schedules/approves posts per channel;
  campaigns and nurture sequences are channel-aware; lead sources include the
  social platforms. **No live platform API connectors yet** (no OAuth to Meta/
  LinkedIn etc.); the `call_webhook` workflow action exists in the catalog but
  is a deferred placeholder. **Recommended next integration phase:** implement
  `call_webhook` (outbound) + a signed public inbound lead-capture endpoint —
  those two unlock Zapier/Make-style integration with virtually every social
  and form platform without per-platform connectors.

## 6. Code review (logic & business flows)

- Full offline suite green: **73 web tests + 55 API unit files**, typecheck
  across 8 workspaces clean, web + API builds clean.
- Live business flows re-verified this audit: phase-6 CRM core, phase-24
  workflow engine (incl. tenant isolation), phase-15 support (incl. role
  boundary checks) — all passed against the running stack.
- Consistent patterns everywhere: tenant-scoped queries, soft deletes, audit
  logs on mutations, zod validation at routers, permission middleware,
  transactional writes, per-action SAVEPOINTs in workflow runs.
- **Gap:** no ESLint configured in any workspace (CLAUDE.md's "run lint" has
  nothing to run). TypeScript strict mode covers types but not style/foot-guns.
  **Recommendation:** add a flat-config ESLint with typescript-eslint.

## 7. DevOps / Docker / Git / GitHub

- **Git/GitHub:** clean tree; branch and main in sync; PR #16 merged; CI
  (verify → docker-build → publish) green; GHCR images
  `apar-elite-crm-{api,web}:{sha,latest}` published multi-arch
  (amd64 + arm64) with provenance attestations.
- **Docker:** multi-stage builds, compose with healthchecked postgres/redis/
  minio/api/web and `depends_on: service_healthy` ordering; migrations/seeds
  gated by env; production boot guard. **Recommendations:** add
  `restart: unless-stopped` to services, add resource limits, pin base images
  by digest, bump `actions/checkout`/`setup-node` (Node-20 deprecation
  warnings), and enable `REDIS_ENABLED`/`BACKGROUND_WORKERS_ENABLED` in
  production profiles.

## 8. UI

- Design system (aurora background, glass panels, variable fonts, status
  pills, avatars, quick-nav ⌘K, grouped collapsible sidebar) already shipped in
  prior phases. **Fixed this audit:** every core record queue now scrolls
  in place instead of stretching the page — leads, opportunities (list +
  each kanban stage column), accounts, contacts, campaigns, social posts, and
  the SDR/inside-sales workspace queues — matching the ScrollableList behavior
  the other 11 pages already had. Phone/email values are now interactive
  (call/mail) everywhere they appear on lead/contact surfaces.

## 9. Azure deployment readiness

The system is 12-factor-ready for Azure today (stateless API, env-only config,
health endpoints, containerized, GHCR images):

- **Compute:** Azure Container Apps (recommended) or AKS. Point ACA at
  `ghcr.io/...` images; API scales horizontally because sessions/state are in
  Postgres and container healthchecks already exist (`/api/v1/health`).
- **Data:** Azure Database for PostgreSQL Flexible Server (pgcrypto available;
  enable `pg_stat_statements`); Azure Cache for Redis (set
  `REDIS_ENABLED=true`); Azure Blob Storage replaces MinIO (S3-compatible
  layer or swap the storage client), or keep MinIO on a container.
- **Ingress/TLS:** Azure Front Door or Application Gateway → HSTS + WAF there;
  set `API_TRUST_PROXY=1` (already supported) so client IPs and rate limiting
  behave behind the proxy.
- **Secrets:** Azure Key Vault → Container Apps secrets for the JWT secrets,
  DB URL, admin bootstrap; the boot guard already refuses dev defaults with
  `NODE_ENV=production`.
- **Pipeline:** current GitHub Actions publish job already produces the
  images; add an `azure/container-apps-deploy` step (or `az containerapp
  update`) after publish. Run migrations as a pre-deploy job
  (`RUN_MIGRATIONS=false` in the app itself, as the compose comments already
  advise).

## 10. Scalability & load-bearing analysis

- **API tier:** stateless (DB sessions, no in-process state that matters) →
  scale by replicas. Two per-instance caveats: the in-memory rate limiter
  becomes per-replica (move to Redis for a global limit) and the dashboard
  cache should flip to Redis (`DASHBOARD_CACHE_ENABLED` + `REDIS_ENABLED`).
- **Database:** the real load-bearing wall, as in any CRM. Mitigations already
  in place: pooled connections, tenant-scoped indexes, soft deletes, slow-query
  logging (`SLOW_QUERY_THRESHOLD_MS=500`), metrics endpoint, observability
  suite (phase 29). Path: vertical first (Flexible Server tiers), then read
  replicas for dashboards/analytics, then table partitioning by tenant if a
  tenant's volume demands it.
- **Web tier:** static nginx-served SPA with 1-year immutable asset caching —
  effectively infinite scale behind a CDN (Front Door).
- **Workflows/AI:** workflow runs execute per-action SAVEPOINTs in one
  transaction — long AI actions should move to background workers at scale
  (`BACKGROUND_WORKERS_ENABLED` exists; job-monitor service already present).
- **Load posture:** phase-29 observability/performance suite validates p95
  latency and slow-query telemetry offline. **Recommendation:** add a k6/
  Artillery baseline (e.g., 200 VU browse + 20 VU write mix) to CI-nightly to
  quantify headroom before production cutover.

## Fixes shipped with this audit

1. In-place scrolling for all core record queues (8 pages, incl. kanban
   columns).
2. Configurable click-to-call (`tel`/`callto`/`sip`/custom dialer template) +
   `mailto:` links, with admin UI, server validation, and unit tests.
3. Security headers on the web nginx.
4. This audit document.
