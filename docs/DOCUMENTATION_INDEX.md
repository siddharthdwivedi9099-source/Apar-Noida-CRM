# Documentation Index

The complete map of project documentation, organized by category, with a canonical
reference of the implemented modules, roles, APIs, AI features, and configuration.
Last reconciled with the implementation on **2026-06-24** — see
[DOCUMENTATION_AUDIT_REPORT.md](./DOCUMENTATION_AUDIT_REPORT.md).

## 1. Business Documentation (`docs/business/`)
- [PRODUCT_VISION.md](./business/PRODUCT_VISION.md) — product vision and goals
- [BUSINESS_REQUIREMENTS.md](./business/BUSINESS_REQUIREMENTS.md) — business requirements
- [FUNCTIONAL_SPECIFICATION.md](./business/FUNCTIONAL_SPECIFICATION.md) — functional specification
- [MODULE_CATALOG.md](./business/MODULE_CATALOG.md) — all implemented modules and status
- [ROLE_CATALOG.md](./business/ROLE_CATALOG.md) — role landscape + canonical seeded roles
- [CAMPAIGN_MANAGEMENT_FUNCTIONAL_SPEC.md](./business/CAMPAIGN_MANAGEMENT_FUNCTIONAL_SPEC.md)
- [PARTNER_RESELLER_FUNCTIONAL_SPEC.md](./business/PARTNER_RESELLER_FUNCTIONAL_SPEC.md)
- [SUPPORT_TICKETING_FUNCTIONAL_SPEC.md](./business/SUPPORT_TICKETING_FUNCTIONAL_SPEC.md)

## 2. Technical Documentation (`docs/technical/`)
- [TECHNICAL_DESIGN.md](./technical/TECHNICAL_DESIGN.md) — technical baseline and shared utilities
- [API_DOCUMENTATION.md](./technical/API_DOCUMENTATION.md) — REST API reference
- [DATA_MODEL.md](./technical/DATA_MODEL.md) — database data model
- [DATABASE_MIGRATIONS.md](./technical/DATABASE_MIGRATIONS.md) — migration framework
- [WORKFLOW_ENGINE.md](./technical/WORKFLOW_ENGINE.md) — workflow engine design

## 3. Architecture Documentation (`docs/architecture/`)
- [ARCHITECTURE.md](./architecture/ARCHITECTURE.md) — system architecture
- [MULTI_TENANCY_DESIGN.md](./architecture/MULTI_TENANCY_DESIGN.md) — tenant isolation model

## 4. Security Documentation (`docs/security/`)
- [SECURITY_DESIGN.md](./security/SECURITY_DESIGN.md) — security posture and controls
- [SECURITY_REVIEW_REPORT.md](./security/SECURITY_REVIEW_REPORT.md) — 23-area security review (2026-06-23/24)
- [ACCESS_CONTROL_GUIDE.md](./security/ACCESS_CONTROL_GUIDE.md) — authn/authz enforcement
- [RBAC_MATRIX.md](./security/RBAC_MATRIX.md) — module × action permission matrix
- [AUDIT_LOGGING_GUIDE.md](./security/AUDIT_LOGGING_GUIDE.md) — audit logging

## 5. AI Documentation (`docs/ai/`)
- [AI_ARCHITECTURE.md](./ai/AI_ARCHITECTURE.md) — AI composition
- [AI_GATEWAY_DESIGN.md](./ai/AI_GATEWAY_DESIGN.md) — single governed gateway
- [PROMPT_REGISTRY.md](./ai/PROMPT_REGISTRY.md) — managed prompt templates
- [AI_AGENT_REGISTRY.md](./ai/AI_AGENT_REGISTRY.md) — agent registry
- [AI_USE_CASE_CATALOG.md](./ai/AI_USE_CASE_CATALOG.md) — AI actions by module
- [RAG_ARCHITECTURE.md](./ai/RAG_ARCHITECTURE.md) — retrieval + grounding
- [CUSTOMER_QUERY_AI_DESIGN.md](./ai/CUSTOMER_QUERY_AI_DESIGN.md) — customer-facing bot
- [AI_GOVERNANCE.md](./ai/AI_GOVERNANCE.md) — governance model
- [AI_GOVERNANCE_REVIEW_REPORT.md](./ai/AI_GOVERNANCE_REVIEW_REPORT.md) — 17-area governance review (2026-06-24)

## 6. Customer Success Documentation (`docs/customer-success/`)
- [CUSTOMER_SUCCESS_FUNCTIONAL_SPEC.md](./customer-success/CUSTOMER_SUCCESS_FUNCTIONAL_SPEC.md)
- [CUSTOMER_HEALTH_SCORE_DESIGN.md](./customer-success/CUSTOMER_HEALTH_SCORE_DESIGN.md)
- [CUSTOMER_TRAINING_FUNCTIONAL_SPEC.md](./customer-success/CUSTOMER_TRAINING_FUNCTIONAL_SPEC.md)
- [ONBOARDING_PLAYBOOK.md](./customer-success/ONBOARDING_PLAYBOOK.md)
- [SCALED_SUCCESS_PLAYBOOK.md](./customer-success/SCALED_SUCCESS_PLAYBOOK.md)
- [ENTERPRISE_SUCCESS_PLAYBOOK.md](./customer-success/ENTERPRISE_SUCCESS_PLAYBOOK.md)

## 7. User Guides (`docs/user-guides/`)
- [USER_MANUAL.md](./user-guides/USER_MANUAL.md) — **comprehensive persona-wise user manual** (all 17 personas, real screens/workflows)
- [EDUCATION_ECOSYSTEM_GUIDE.md](./user-guides/EDUCATION_ECOSYSTEM_GUIDE.md) — using the CRM for education (eLite SIS) and IT service-project leads
- [DEMO_LOGINS.md](./user-guides/DEMO_LOGINS.md) — role-based demo logins (one per role) for exploring RBAC
- [USER_GUIDE.md](./user-guides/USER_GUIDE.md) — general user guide
- [SALES_USER_GUIDE.md](./user-guides/SALES_USER_GUIDE.md)
- [MARKETING_USER_GUIDE.md](./user-guides/MARKETING_USER_GUIDE.md)
- [SUPPORT_USER_GUIDE.md](./user-guides/SUPPORT_USER_GUIDE.md)
- [CUSTOMER_SUCCESS_USER_GUIDE.md](./user-guides/CUSTOMER_SUCCESS_USER_GUIDE.md)
- [PARTNER_MANAGER_USER_GUIDE.md](./user-guides/PARTNER_MANAGER_USER_GUIDE.md)
- [RESELLER_MANAGER_USER_GUIDE.md](./user-guides/RESELLER_MANAGER_USER_GUIDE.md)
- [TRAINING_PORTAL_USER_GUIDE.md](./user-guides/TRAINING_PORTAL_USER_GUIDE.md)
- [CUSTOMER_PORTAL_USER_GUIDE.md](./user-guides/CUSTOMER_PORTAL_USER_GUIDE.md)
- [AI_ASSISTANT_USER_GUIDE.md](./user-guides/AI_ASSISTANT_USER_GUIDE.md)

## 8. Admin Guides
- [ADMIN_GUIDE.md](./user-guides/ADMIN_GUIDE.md) — tenant administration, configuration, governance

## 9. API Documentation
- [API_DOCUMENTATION.md](./technical/API_DOCUMENTATION.md) — all route prefixes (see canonical table below)

## 10. Deployment Documentation (`docs/deployment/`)
- [DEPLOYMENT_GUIDE.md](./deployment/DEPLOYMENT_GUIDE.md) — deployment steps
- [DEVOPS_GUIDE.md](./deployment/DEVOPS_GUIDE.md) — CI/CD and operations
- [PRODUCTION_READINESS_CHECKLIST.md](./deployment/PRODUCTION_READINESS_CHECKLIST.md) — release gate
- [OBSERVABILITY_GUIDE.md](./deployment/OBSERVABILITY_GUIDE.md) — logging/metrics
- [PERFORMANCE_GUIDE.md](./deployment/PERFORMANCE_GUIDE.md) — performance tuning
- Configuration reference: [`.env.example`](../.env.example) — all 56 environment options

## 11. Testing Documentation (`docs/testing/`)
- [TEST_CASES.md](./testing/TEST_CASES.md) — **comprehensive test cases** across all modules, AI, security, and non-functional
- [TESTING_STRATEGY.md](./testing/TESTING_STRATEGY.md)
- [QA_CHECKLIST.md](./testing/QA_CHECKLIST.md)

## 12. Release Documentation (repository root)
- [CHANGELOG.md](../CHANGELOG.md) · [RELEASE_NOTES.md](../RELEASE_NOTES.md) · [VERSION.md](../VERSION.md)
- [KNOWN_LIMITATIONS.md](../KNOWN_LIMITATIONS.md) · [POST_RELEASE_ROADMAP.md](../POST_RELEASE_ROADMAP.md)
- [FINAL_PRODUCTION_READINESS_REPORT.md](../FINAL_PRODUCTION_READINESS_REPORT.md) · [ROADMAP.md](../ROADMAP.md)

---

# Canonical Implementation Reference

Extracted from code on 2026-06-24. Authoritative counts: **26 modules · 287 API routes · 28 roles · 37 AI actions · 40 prompt templates · 16 AI agents · 18 dashboards · 56 config options**.

## Modules → API mount

| # | Module (`apps/api/src/modules/`) | Route prefix | Documented in |
|---|----------------------------------|--------------|---------------|
| 1 | auth | `/auth` | API_DOCUMENTATION, SECURITY_DESIGN |
| 2 | rbac | `/rbac` | API_DOCUMENTATION, RBAC_MATRIX |
| 3 | tenant-config | `/tenant-config` | API_DOCUMENTATION, ADMIN_GUIDE |
| 4 | crm | `/` (records/leads/accounts/contacts) | API_DOCUMENTATION |
| 5 | opportunities | `/opportunities` | API_DOCUMENTATION |
| 6 | campaigns | `/campaigns` | API_DOCUMENTATION, CAMPAIGN spec |
| 7 | social | `/social` | API_DOCUMENTATION |
| 8 | sales-workspaces | `/sales-workspaces` | API_DOCUMENTATION |
| 9 | business-development | `/business-development` | API_DOCUMENTATION |
| 10 | (presales) | `/presales` | API_DOCUMENTATION |
| 11 | partners | `/partners` | API_DOCUMENTATION, PARTNER_RESELLER spec |
| 12 | resellers | `/resellers` | API_DOCUMENTATION, PARTNER_RESELLER spec |
| 13 | support | `/support` | API_DOCUMENTATION, SUPPORT_TICKETING spec |
| 14 | customer-success | `/customer-success` | API_DOCUMENTATION, CS spec |
| 15 | training | `/training` | API_DOCUMENTATION, CUSTOMER_TRAINING spec |
| 16 | customer-portal | `/customer-portal` | API_DOCUMENTATION, CUSTOMER_PORTAL guide |
| 17 | customer-query | `/customer-query` | API_DOCUMENTATION, CUSTOMER_QUERY_AI_DESIGN |
| 18 | ai (gateway) | `/ai` | API_DOCUMENTATION, AI_GATEWAY_DESIGN |
| 19 | ai (registry) | `/ai` | API_DOCUMENTATION, PROMPT_REGISTRY, AI_AGENT_REGISTRY |
| 20 | ai-actions | `/ai` | API_DOCUMENTATION, AI_USE_CASE_CATALOG |
| 21 | rag | `/ai` | API_DOCUMENTATION, RAG_ARCHITECTURE |
| 22 | dashboards | `/dashboards` | API_DOCUMENTATION |
| 23 | notifications | `/notifications` | API_DOCUMENTATION |
| 24 | approvals | `/approvals` | API_DOCUMENTATION |
| 25 | workflows | `/workflows` | API_DOCUMENTATION, WORKFLOW_ENGINE |
| 26 | audit | `/audit` | API_DOCUMENTATION, AUDIT_LOGGING_GUIDE |
| — | observability | `/observability` | API_DOCUMENTATION, OBSERVABILITY_GUIDE |
| — | health | `/health`, `/` | API_DOCUMENTATION |

## Seeded Role Templates (28)

`Super Admin` · `CRM Admin` · `Customer Portal User` · `Social Media Marketing Executive` · `Social Media Marketing Manager` · `Marketing Executive` · `Marketing Manager` · `Inside Sales Executive` · `Inside Sales Manager` · `Sales Development Representative` · `SDR Manager` · `Business Development Executive` · `Business Development Manager` · `Sales Executive` · `Sales Manager` · `Sales Head` · `Sales Leader` · `Presales Executive` · `Presales Manager` · `Support Executive` · `Support Manager` · `Partner Manager` · `Reseller Manager` · `Customer Success Manager - Onboarding` · `Customer Success Manager - Scaled` · `Customer Success Manager - Enterprise` · `Customer Success Head` · `Executive Leadership`

Defined in `packages/types/src/rbac.ts`; permission detail in [RBAC_MATRIX.md](./security/RBAC_MATRIX.md) and [ROLE_CATALOG.md](./business/ROLE_CATALOG.md).

## AI Features

- **AI actions (37)** — catalog in [AI_USE_CASE_CATALOG.md](./ai/AI_USE_CASE_CATALOG.md) (`packages/types/src/ai-actions.ts`).
- **Prompt templates (40)** — [PROMPT_REGISTRY.md](./ai/PROMPT_REGISTRY.md) (`packages/types/src/ai.ts`).
- **AI agents (16)** — [AI_AGENT_REGISTRY.md](./ai/AI_AGENT_REGISTRY.md) (`packages/types/src/ai-registry.ts`): `sales_copilot`, `marketing_copilot`, `social_media`, `sdr_assistant`, `presales_proposal`, `support_resolution`, `cs_onboarding`, `cs_scaled`, `cs_enterprise`, `customer_training`, `customer_query_resolution`, `partner_manager`, `reseller_growth`, `executive_insight`, `data_quality`, `workflow_automation`.
- **Governance** — [AI_GOVERNANCE.md](./ai/AI_GOVERNANCE.md) and [AI_GOVERNANCE_REVIEW_REPORT.md](./ai/AI_GOVERNANCE_REVIEW_REPORT.md).

## Configuration

All 56 environment options are defined in `apps/api/src/config/env.ts` and documented in [`.env.example`](../.env.example). Production-critical settings (`JWT_ACCESS_TOKEN_SECRET`, `JWT_REFRESH_TOKEN_SECRET`, `AUTH_COOKIE_SECURE`, `API_TRUST_PROXY`, `API_CORS_ORIGIN`) are also covered by [PRODUCTION_READINESS_CHECKLIST.md](./deployment/PRODUCTION_READINESS_CHECKLIST.md) and [SECURITY_REVIEW_REPORT.md](./security/SECURITY_REVIEW_REPORT.md).
