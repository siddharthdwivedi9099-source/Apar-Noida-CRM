# Comprehensive Test Cases

**Scope:** functional, security, AI-governance, and non-functional test cases for the AI-Native CRM (v1.0.0), covering all 26 modules, 49 role templates, 32 persona access definitions, the customer portal, and the AI layer. Use alongside [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) and [QA_CHECKLIST.md](./QA_CHECKLIST.md).

## How to use this document

- **ID format:** `TC-<AREA>-<NNN>`.
- **Priority:** P1 (critical / release-blocking), P2 (important), P3 (edge/nice-to-have).
- **Type:** Functional (F), Security (S), AI-Governance (A), Negative (N), Non-Functional (NF).
- **Status legend for automation:** ✅ covered by an automated test today, ☐ manual / to-automate. (Current automated suites: 97 API + 16 web = 113 tests.)
- Unless stated otherwise, **Precondition:** a configured environment with the database enabled, the demo tenant seeded, and the actor signed in with the noted role.

---

## 1. Authentication & Session (`AUTH`)

| ID | Title | Type | Pri | Steps | Expected result |
|----|-------|------|-----|-------|-----------------|
| TC-AUTH-001 | Valid login | F | P1 | POST `/auth/login` with correct tenant/email/password | `200`; user, roles, permissionCodes, access token returned; refresh cookie set (HttpOnly) ✅ |
| TC-AUTH-002 | Invalid password | N/S | P1 | Login with wrong password | `401` generic "Invalid tenant, email, or password." (no field disclosure) ✅ |
| TC-AUTH-003 | Unknown tenant | N/S | P1 | Login with non-existent tenant slug | `401` same generic message (no tenant enumeration) ✅ |
| TC-AUTH-004 | Unknown email | N/S | P2 | Login with unknown email | `401` same generic message (no user enumeration) ✅ |
| TC-AUTH-005 | Input validation | N | P2 | Login with missing/blank fields | `400` VALIDATION_ERROR ✅ |
| TC-AUTH-006 | Account lockout | S | P1 | Fail login N times (≥ `AUTH_ACCOUNT_LOCK_THRESHOLD`) | Account locked until window passes; subsequent correct password still rejected during lock ☐ |
| TC-AUTH-007 | Login rate limiting | S | P1 | Exceed login attempts per window for same ip:tenant:email | `429` rate-limited; attempt recorded ☐ |
| TC-AUTH-008 | Refresh token rotation | F/S | P1 | POST `/auth/refresh` with valid refresh cookie | New access + refresh issued; old refresh no longer valid ✅ |
| TC-AUTH-009 | Refresh reuse detection | S | P1 | Reuse a previously rotated refresh token | `401`; session revoked; failure audit-logged ☐ |
| TC-AUTH-010 | Expired/invalid refresh | N | P2 | Refresh with tampered/expired token | `401` AUTHENTICATION_ERROR ✅ |
| TC-AUTH-011 | Logout revokes session | F/S | P1 | POST `/auth/logout`; then call a protected route with the old token | Session revoked; protected call rejected ☐ |
| TC-AUTH-012 | `GET /auth/me` | F | P2 | Call `/auth/me` with valid token | Returns current identity, roles, permissions ✅ |
| TC-AUTH-013 | Missing/!Bearer header | N | P1 | Call protected route without `Authorization: Bearer` | `401` AUTHENTICATION_ERROR ✅ |
| TC-AUTH-014 | Tampered JWT signature | S | P1 | Alter token payload/signature | `401`; signature verified before payload is trusted ✅ |
| TC-AUTH-015 | `alg:none` forgery | S | P1 | Submit a token with `alg:none`/no signature | Rejected (HMAC always recomputed) ✅ |

---

## 2. RBAC & Authorization (`RBAC`)

| ID | Title | Type | Pri | Steps | Expected result |
|----|-------|------|-----|-------|-----------------|
| TC-RBAC-001 | Every protected module requires auth | S | P1 | Hit each module's route prefix unauthenticated | `401` for all data routers; only `health` is public ✅ |
| TC-RBAC-002 | Permission required for action | F/S | P1 | As a role lacking `X.create`, attempt create | `403` FORBIDDEN/AUTHORIZATION_ERROR ✅ |
| TC-RBAC-003 | allOf semantics | F | P2 | Endpoint requiring multiple permissions; actor missing one | `403` ☐ |
| TC-RBAC-004 | oneOf semantics | F | P2 | Endpoint requiring any-of; actor has one | Allowed ☐ |
| TC-RBAC-005 | Field-level permission | S | P2 | CRM record action gated by field permission; actor lacks it | Restricted field/action denied ☐ |
| TC-RBAC-006 | Record-level scope (own vs all) | S | P1 | Request a scope (e.g., resellers "all") the actor can't see | `403` "do not have permission to inspect this scope"; results otherwise owner-scoped ☐ |
| TC-RBAC-007 | Catalog seeds role templates | F | P2 | Inspect seeded roles | All seeded templates are present, including persona-linked access roles ✅ |
| TC-RBAC-008 | Dashboard service-layer authz | S | P1 | Authenticated user without dashboard permission opens a dashboard | Catalog reachable; data path returns `403` via `requirePermission` ☐ |
| TC-RBAC-009 | Saved-view ownership | S | P2 | User edits another user's saved view | `403` "only modify your own saved views" ☐ |

---

## 3. Tenant Isolation (`TEN`)

| ID | Title | Type | Pri | Steps | Expected result |
|----|-------|------|-----|-------|-----------------|
| TC-TEN-001 | Cross-tenant record by ID | S | P1 | As tenant A, request a record ID belonging to tenant B | `404`/denied; every query is `tenant_id`-scoped ☐ |
| TC-TEN-002 | Cross-tenant list leakage | S | P1 | List endpoints as tenant A | Only tenant A rows returned ☐ |
| TC-TEN-003 | Cross-tenant update/delete | S | P1 | Attempt update/delete of tenant B's record | No rows affected (WHERE id AND tenant_id) ☐ |
| TC-TEN-004 | Config isolation | S | P2 | Tenant A reads AI/audit/governance settings | Sees only its own tenant's rows ☐ |

---

## 4. Input Validation & Error Handling (`VAL`)

| ID | Title | Type | Pri | Steps | Expected result |
|----|-------|------|-----|-------|-----------------|
| TC-VAL-001 | Body schema validation | N | P1 | Send malformed/oversized/extra fields | `400` VALIDATION_ERROR with flattened details ✅ |
| TC-VAL-002 | Param validation (UUID) | N | P2 | Pass a non-UUID where a UUID is required | `400` validation error ☐ |
| TC-VAL-003 | Query validation | N | P2 | Invalid pagination/date filters | `400`; or safe defaults applied ☐ |
| TC-VAL-004 | JSON body limit | S | P2 | POST a body > 1mb | `413`/rejected ☐ |
| TC-VAL-005 | Generic 500 (no stack) | S | P1 | Force an unexpected error | `500` generic message; no stack/DB details leaked ✅ |
| TC-VAL-006 | Mass-assignment guard | S | P2 | Send unexpected columns in an update body | Only whitelisted columns persisted ☐ |
| TC-VAL-007 | SQL injection attempt | S | P1 | Inject SQL in search/sort/filter inputs | Treated as data (parameterized); no injection; safe sort whitelist ☐ |

---

## 5. CRM Core — Leads / Accounts / Contacts (`CRM`)

| ID | Title | Type | Pri | Steps | Expected result |
|----|-------|------|-----|-------|-----------------|
| TC-CRM-001 | Create lead | F | P1 | POST `/leads` valid body | `201`; lead created, tenant-scoped, audited ☐ |
| TC-CRM-002 | List/filter/paginate leads | F | P2 | GET `/leads?search=&status=&page=` | Filtered, paginated results ☐ |
| TC-CRM-003 | Lead detail + timeline + notes | F | P2 | GET `/leads/:id`, `/records/lead/:id/timeline`, `/notes` | Detail, activity timeline, notes returned ☐ |
| TC-CRM-004 | Update lead | F | P2 | PATCH `/leads/:id` | Updated; change audited ☐ |
| TC-CRM-005 | Soft-delete lead | F | P2 | DELETE `/leads/:id` | Archived (deleted_at set), excluded from lists ☐ |
| TC-CRM-006 | Account & contact CRUD | F | P1 | Repeat create/read/update/delete for accounts and contacts | Parity behavior; relationships intact ☐ |
| TC-CRM-007 | Add note / timeline entry | F | P2 | POST a note on a record | Note stored; appears in timeline ☐ |
| TC-CRM-008 | Permission gating on CRUD | S | P1 | CRUD without the relevant permission | `403` ☐ |

---

## 6. Opportunities & Pipeline (`OPP`)

| ID | Title | Type | Pri | Steps | Expected |
|----|-------|------|-----|-------|----------|
| TC-OPP-001 | Create opportunity | F | P1 | POST `/opportunities` with stage/value | `201`; created and tenant-scoped ☐ |
| TC-OPP-002 | Stage movement (role-aware) | F/S | P1 | Move stage with/without permission | Allowed only with permission; transition audited ☐ |
| TC-OPP-003 | Pipeline (Kanban) view | F | P2 | GET pipeline grouping | Opportunities grouped by stage ☐ |
| TC-OPP-004 | Dashboard metrics | F | P2 | GET opportunity dashboard | Counts/values by stage returned ☐ |
| TC-OPP-005 | Empty-state pagination | N | P3 | List with no results | Stable pagination envelope (no crash) ☐ |

---

## 7. Campaigns (`CAMP`)

| ID | Title | Type | Pri | Steps | Expected |
|----|-------|------|-----|-------|----------|
| TC-CAMP-001 | Campaign CRUD | F | P1 | Create/read/update/delete campaign | Lifecycle works; audited ☐ |
| TC-CAMP-002 | Member add/remove | F | P2 | Add/remove leads/contacts as members | Membership reflected; attribution linked ☐ |
| TC-CAMP-003 | Campaign detail payload | F | P3 | GET campaign detail | Members + metrics returned ☐ |
| TC-CAMP-004 | Permission gating | S | P2 | Manage campaign without permission | `403` ☐ |

---

## 8. Social Media Marketing (`SOC`)

| ID | Title | Type | Pri | Steps | Expected |
|----|-------|------|-----|-------|----------|
| TC-SOC-001 | Post CRUD | F | P2 | Create/edit/schedule/delete a post | Lifecycle works ☐ |
| TC-SOC-002 | Detail payload | F | P3 | GET post detail | Channel/schedule/engagement fields ☐ |
| TC-SOC-003 | Permission gating | S | P2 | Manage post without permission | `403` ☐ |

---

## 9. Sales Workspaces — SDR / Inside Sales (`WS`)

| ID | Title | Type | Pri | Steps | Expected |
|----|-------|------|-----|-------|----------|
| TC-WS-001 | SDR workspace loads | F | P2 | Open `/sales/sdr` | Prioritized lead queue + options ☐ |
| TC-WS-002 | Inside-sales workspace loads | F | P2 | Open `/sales/inside-sales` | Workspace renders with permitted data ☐ |
| TC-WS-003 | Lead workflow update | F | P2 | Update lead status/next step | Persisted; reflected in workspace ☐ |
| TC-WS-004 | Workspace options behavior | F | P3 | Read configurable workspace options | Tenant option sets honored ☐ |

---

## 10. Business Development & Presales (`BDP`)

| ID | Title | Type | Pri | Steps | Expected |
|----|-------|------|-----|-------|----------|
| TC-BDP-001 | BD pipeline CRUD | F | P2 | Manage BD initiatives/pipeline | Lifecycle works; scoped/audited ☐ |
| TC-BDP-002 | Presales engagement CRUD | F | P2 | Manage presales engagements | Lifecycle works ☐ |
| TC-BDP-003 | Permission gating | S | P2 | Act without permission | `403` ☐ |

---

## 11. Partners (`PRT`) & 12. Resellers (`RES`)

| ID | Title | Type | Pri | Steps | Expected |
|----|-------|------|-----|-------|----------|
| TC-PRT-001 | Partner CRUD | F | P2 | Manage partner records/tiers | Lifecycle works; audited ☐ |
| TC-PRT-002 | Partner permission gating | S | P2 | Act without permission | `403` ☐ |
| TC-RES-001 | Reseller CRUD | F | P2 | Manage reseller records | Lifecycle works ☐ |
| TC-RES-002 | Deal registration | F | P1 | Register a deal with margin/agreement | Deal linked; scoped pipeline updated ☐ |
| TC-RES-003 | Scoped pipeline visibility | S | P1 | View pipeline as owner vs all-scope | Only permitted resellers/owners visible ☐ |

---

## 13. Support Ticketing (`SUP`)

| ID | Title | Type | Pri | Steps | Expected |
|----|-------|------|-----|-------|----------|
| TC-SUP-001 | Ticket CRUD/triage | F | P1 | Create/update/resolve a ticket | Lifecycle works; status/priority changes audited ☐ |
| TC-SUP-002 | Assignment & escalation | F | P2 | Assign/escalate a ticket | Reflected; manager oversight works ☐ |
| TC-SUP-003 | Ticket from AI query | F | P2 | AI-escalated query creates a ticket | Ticket created with `origin: customer_query_ai` ☐ |
| TC-SUP-004 | Permission gating | S | P2 | Act without permission | `403` ☐ |

---

## 14. Customer Success / Health / Onboarding (`CS`)

| ID | Title | Type | Pri | Steps | Expected |
|----|-------|------|-----|-------|----------|
| TC-CS-001 | Managed account view | F | P2 | Open CS account | Health score, onboarding plan, playbook tasks shown ☐ |
| TC-CS-002 | Health score computed | F | P2 | Inspect health indicators | Score reflects signals; risk surfaced ☐ |
| TC-CS-003 | Onboarding task completion | F | P2 | Complete a playbook task | Progress updates; audited ☐ |
| TC-CS-004 | Variant scoping (Onb/Scaled/Ent) | S | P2 | Each CS variant role sees its portfolio | Correct scope per role ☐ |

---

## 15. Training & Knowledge Base (`KB`)

| ID | Title | Type | Pri | Steps | Expected |
|----|-------|------|-----|-------|----------|
| TC-KB-001 | Training path/course CRUD | F | P2 | Manage learning paths/courses | Lifecycle works ☐ |
| TC-KB-002 | Learner progress | F | P3 | Record progress | Tracked per learner ☐ |
| TC-KB-003 | Article authoring & states | F | P1 | Create → approved → published | State machine enforced ☐ |
| TC-KB-004 | Only approved+published feed AI | A/S | P1 | Draft/unpublished article | Excluded from retrieval/customer-query ☐ |
| TC-KB-005 | Document upload | F | P3 | Upload a knowledge document | Stored and chunked for retrieval ☐ |
| TC-KB-006 | Knowledge gap resolution | F | P2 | Resolve a gap by publishing an article | Gap marked resolved ☐ |

---

## 16. Customer Portal — External Isolation (`POR`)

| ID | Title | Type | Pri | Steps | Expected |
|----|-------|------|-----|-------|----------|
| TC-POR-001 | Portal profile required | S | P1 | Access portal without active profile | `403` CUSTOMER_PORTAL_PROFILE_REQUIRED ☐ |
| TC-POR-002 | Account-scoped data only | S | P1 | Portal user requests tickets/data | Only own `tenant_id+user_id+account_id` data ☐ |
| TC-POR-003 | Raise & track ticket | F | P2 | Create a portal ticket | Ticket created and visible to the customer ☐ |
| TC-POR-004 | Portal AI ask | A | P1 | Ask a question in portal | Grounded answer + citations, or escalation ☐ |
| TC-POR-005 | Cross-account denial | S | P1 | Portal user requests another account's ticket id | Denied/`404` ☐ |
| TC-POR-006 | Permission gating | S | P1 | Portal action without `customer_portal.*` | `403` ☐ |

---

## 17. Customer Query AI Bot (`CQ`)

| ID | Title | Type | Pri | Steps | Expected |
|----|-------|------|-----|-------|----------|
| TC-CQ-001 | Grounded answer with citations | A | P1 | Ask with matching approved knowledge | Extractive answer cites sources; `isGrounded=true` ✅ (unit) |
| TC-CQ-002 | No-answer escalation | A | P1 | Ask with no matching knowledge | Safe "couldn't find" response; escalated `no_answer`; gap logged; ticket created ✅ (unit) |
| TC-CQ-003 | Low-confidence escalation | A | P1 | Ask where confidence < 0.4 | Escalated `low_confidence`; flagged ✅ (unit) |
| TC-CQ-004 | Level-3 always escalates | A | P1 | Ask containing a level-3 keyword (e.g., "outage", "billing") | Escalated `level_3`; support ticket created ✅ (unit) |
| TC-CQ-005 | Permission filtered retrieval | S | P1 | Customer asks; restricted sources exist | Restricted sources excluded; `restrictedSourceCount` reported ☐ |
| TC-CQ-006 | Feedback capture | A | P2 | Submit helpful/not-helpful | Stored; dashboard aggregates update ☐ |
| TC-CQ-007 | Session access control | S | P1 | Non-owner non-reviewer opens a session | `403` ☐ |
| TC-CQ-008 | No LLM execution surface | S | P2 | Submit injection-style text | Used only for retrieval matching; no generative execution ☐ |

---

## 18. AI Gateway / Prompt Registry / Agent Registry / AI Actions (`AI`)

| ID | Title | Type | Pri | Steps | Expected |
|----|-------|------|-----|-------|----------|
| TC-AI-001 | Single governed entry | A | P1 | Execute via `/ai/gateway/execute` | All AI runs through the gateway; usage + audit logged ☐ |
| TC-AI-002 | Disabled tenant fails closed | A/S | P1 | Execute with AI disabled | `403` AI_DISABLED; denial logged ☐ |
| TC-AI-003 | Unknown template | N | P2 | Execute with bad `templateKey` | `400` AI_TEMPLATE_NOT_FOUND ☐ |
| TC-AI-004 | Provider override gating | S | P2 | Override provider when not allowed | `403` AI_OVERRIDE_NOT_ALLOWED ☐ |
| TC-AI-005 | Prompt-variable sanitizer | S | P1 | Pass values with control chars / `{{ }}` / >8000 chars | Stripped/neutralized/clamped before interpolation ✅ |
| TC-AI-006 | Action permission check | A/S | P1 | Run an action without its permission | `403` ☐ |
| TC-AI-007 | Sensitive action → review | A | P1 | Run a sensitive action | `pending_review`; output not usable until approved ☐ |
| TC-AI-008 | Review approve/reject | A | P1 | Reviewer approves/rejects a run | Only review-permitted users; decision audited; status transitions only from pending ☐ |
| TC-AI-009 | Prompt registry versioning | A | P2 | Edit a prompt template | New version; activate/approve permissions enforced ☐ |
| TC-AI-010 | Agent registry governance | A | P2 | Create/update an agent | Tools/data-scope/approval/escalation stored; permissioned; audited ☐ |
| TC-AI-011 | Live provider when configured | A | P2 | With a provider key set, execute | Real provider call; `placeholder=false`; usage `success` ✅ (unit, mocked) |
| TC-AI-012 | Placeholder when unconfigured | A | P1 | With no key, execute | Deterministic placeholder; no network call ✅ (unit) |
| TC-AI-013 | Provider failure handling | A/N | P2 | Provider returns non-2xx/timeout | Governed `error` result (no throw); status logged as `error` ✅ (unit) |

---

## 19. RAG Retrieval (`RAG`)

| ID | Title | Type | Pri | Steps | Expected |
|----|-------|------|-----|-------|----------|
| TC-RAG-001 | Retrieve-before-answer | A | P1 | Trigger a grounded answer | Retrieval runs as the actor before any answer ✅ (unit) |
| TC-RAG-002 | Source permission filtering | S | P1 | Sources with `required_permission` | Excluded unless actor holds permission ☐ |
| TC-RAG-003 | Approved/published only | A | P1 | Mix of draft/approved articles | Only approved+published returned ☐ |
| TC-RAG-004 | Citations present | A | P2 | Inspect results | Source id/name/type + snippet + score ✅ (unit) |
| TC-RAG-005 | Knowledge-gap logging | A | P2 | Query with no results | `knowledge_gaps` row created/incremented ☐ |
| TC-RAG-006 | Tenant scoping | S | P1 | Retrieval as tenant A | Only tenant A knowledge ☐ |

---

## 20. Dashboards & Insights (`DASH`)

| ID | Title | Type | Pri | Steps | Expected |
|----|-------|------|-----|-------|----------|
| TC-DASH-001 | Catalog with `permitted` flags | F | P2 | GET dashboards catalog | Each dashboard flagged per permission ☐ |
| TC-DASH-002 | Data requires permission | S | P1 | Open a dashboard without permission | `403` from service layer ☐ |
| TC-DASH-003 | Drilldown | F | P2 | Drill a widget | Detail rows returned ☐ |
| TC-DASH-004 | Export gated + audited | S | P2 | Export a dashboard | Requires export permission; export audit-logged ☐ |
| TC-DASH-005 | Saved views CRUD + ownership | F/S | P2 | Create/edit/delete own view; attempt others' | Own works; others' edit `403` ☐ |

---

## 21. Workflows / Approvals / Notifications (`WF`)

| ID | Title | Type | Pri | Steps | Expected |
|----|-------|------|-----|-------|----------|
| TC-WF-001 | Workflow CRUD + conditions | F | P2 | Create a workflow with condition/operator/value | Stored and valid ☐ |
| TC-WF-002 | Workflow engine evaluation | F | P2 | Trigger conditions | Actions fire as configured ✅ (unit engine) |
| TC-APR-001 | Approval request/decision | F | P1 | Create approval; approve/reject; comment | Lifecycle works; permissioned; audited ☐ |
| TC-NOT-001 | Notifications list/read | F | P2 | List, mark read, mark all read | State persists ☐ |
| TC-NOT-002 | Notification preferences | F | P3 | Update preferences | Honored on future notifications ☐ |

---

## 22. Tenant Configuration (`CFG`)

| ID | Title | Type | Pri | Steps | Expected |
|----|-------|------|-----|-------|----------|
| TC-CFG-001 | Module enable/disable | F | P1 | Toggle a module | Hidden/shown in navigation; audited ☐ |
| TC-CFG-002 | Terminology rename | F | P2 | Rename an object | Labels update tenant-wide ☐ |
| TC-CFG-003 | Theme settings | F | P3 | Change theme | UI reflects branding ☐ |
| TC-CFG-004 | Option sets | F | P2 | Edit statuses/stages/categories | Dropdowns reflect changes ☐ |
| TC-CFG-005 | Custom fields | F | P2 | Define a custom field | Available on the entity ☐ |
| TC-CFG-006 | Config requires permission | S | P1 | Configure without permission | `403` ☐ |

---

## 23. Audit Logging (`AUD`)

| ID | Title | Type | Pri | Steps | Expected |
|----|-------|------|-----|-------|----------|
| TC-AUD-001 | Auth events logged | S | P1 | Login/refresh/logout | Audit rows with status ☐ |
| TC-AUD-002 | Access-denied logged | S | P1 | Trigger a `401`/`403` while authenticated | `security.access_denied` audit row ☐ |
| TC-AUD-003 | Export logged | S | P2 | Export audit/dashboard | `audit.export` event recorded ☐ |
| TC-AUD-004 | Config change logged | S | P2 | Change governance/config | Change event with changed fields ☐ |
| TC-AUD-005 | AI runs logged | A | P1 | Execute AI action/gateway | `ai_*` audit + usage rows ☐ |

---

## 24. Security & Hardening (`SEC`)

| ID | Title | Type | Pri | Steps | Expected |
|----|-------|------|-----|-------|----------|
| TC-SEC-001 | Secure headers | S | P1 | Inspect response headers | Helmet set (no-referrer, CORP same-site, prod HSTS); `x-powered-by` absent ☐ |
| TC-SEC-002 | CORS allowlist | S | P1 | Request from disallowed origin | No `Access-Control-Allow-Origin`; allowed origins pass ☐ |
| TC-SEC-003 | Production secret guard | S | P1 | Boot with `NODE_ENV=production` and dev secrets/default admin/insecure cookie | Process refuses to start ✅ (verified) |
| TC-SEC-004 | Refresh cookie attributes | S | P1 | Inspect refresh cookie | `HttpOnly`, `Secure` (config), `SameSite`, path `/api/v1/auth` ☐ |
| TC-SEC-005 | Trust-proxy configurable | S | P2 | Set `API_TRUST_PROXY=1` | App boots trusting one hop (not all) ✅ (boot test) |
| TC-SEC-006 | Log redaction | S | P1 | Trigger logs containing tokens/passwords | Redacted to `[redacted]` ☐ |
| TC-SEC-007 | No secrets in repo | S | P1 | Scan repo | No committed `.env`; no hardcoded keys ✅ (audited) |
| TC-SEC-008 | Global API rate limiter | S | P2 | Exceed `API_RATE_LIMIT_MAX` | `429` RATE_LIMITED ✅ (unit) |
| TC-SEC-009 | Output XSS safety | S | P2 | Store script-like content; render in UI | Escaped by React; no execution ☐ |

---

## 25. Non-Functional (`NF`)

| ID | Title | Type | Pri | Steps | Expected |
|----|-------|------|-----|-------|----------|
| TC-NF-001 | Health endpoint | NF | P1 | GET `/health` | `200` with DB/Redis dependency statuses ✅ |
| TC-NF-002 | Slow-query logging | NF | P2 | Run a query above `SLOW_QUERY_THRESHOLD_MS` | Logged as slow ☐ |
| TC-NF-003 | Metrics surface | NF | P2 | GET `/observability/*` | Job + cache status returned ☐ |
| TC-NF-004 | Cache seam | NF | P3 | Dashboard wrap() | Hit/miss accounted; recompute when Redis off ☐ |
| TC-NF-005 | Pagination performance | NF | P3 | Large list pagination | Bounded page sizes; stable latency ☐ |
| TC-NF-006 | Build/typecheck/test gates | NF | P1 | Run CI pipeline | Build → typecheck → 113 tests → deployment validation all pass ✅ |
| TC-NF-007 | Horizontal-scale caveat | NF | P2 | Multi-replica rate limit/cache | DOCUMENTED LIMITATION: in-memory primitives need Redis for correctness ☐ |

---

## Coverage Summary

| Area | Cases | Automated today |
|------|-------|-----------------|
| Auth & session | 15 | partial (login, refresh, validation, JWT) |
| RBAC & authz | 9 | partial (auth-required matrix, role catalog) |
| Tenant isolation | 4 | manual (verified by review) |
| Validation & errors | 7 | partial |
| CRM / Opp / Camp / Social | ~25 | manual + contract |
| Workspaces / BD / Presales | ~10 | manual |
| Partners / Resellers | ~5 | manual |
| Support / CS / Training-KB | ~14 | manual |
| Customer portal | 6 | manual |
| Customer-query AI | 8 | unit (escalation/confidence) ✅ |
| AI gateway/registry/actions | 13 | unit (providers, sanitizer, registry) ✅ |
| RAG | 6 | unit (retrieval/citations) ✅ |
| Dashboards | 5 | manual |
| Workflows/Approvals/Notifications | 5 | unit (engine) |
| Tenant config | 6 | manual |
| Audit | 5 | manual |
| Security | 9 | partial (guard, rate limit, scan) ✅ |
| Non-functional | 7 | partial (health, gates) ✅ |

**Recommended automation priorities (next):** tenant-isolation suite, record-level scope, customer-portal isolation, and AI sensitive-action review — all P1 and currently manual. These require the live-DB integration test harness noted in the production-readiness plan.
