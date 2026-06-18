# Changelog

## [Unreleased]

Current repository state now includes Phase 1 through Phase 19 implementation work.

### Added

- Phase 19 migration `20260619050000_phase19_prompt_agent_registry.sql` with tenant-scoped `ai_prompts`, immutable `ai_prompt_versions`, and `ai_agents`
- Prompt Registry: create, edit, version (immutable history), activate/deactivate, approval workflow (`draft`/`pending_review`/`approved`/`rejected`), prompt module, prompt role, input/output schemas, guardrails, and created-by/updated-by authorship
- governance guard: a prompt can only be activated once its current version is `approved` (`AI_PROMPT_NOT_APPROVED`)
- AI Agent Registry with sixteen baseline system agents provisioned per tenant (Sales Copilot, Marketing Copilot, Social Media, SDR Assistant, Presales Proposal, Support Resolution, three Customer Success agents, Customer Training, Customer Query Resolution, Partner Manager, Reseller Growth, Executive Insight, Data Quality, Workflow Automation)
- agent fields: name, purpose, module, allowed tools, allowed roles, data-access scope (`own`/`team`/`module`/`tenant`), human-approval requirement, status, logging-enabled, and escalation rules
- registry types and defaults in `@crm/types` (`defaultAiAgents`, prompt/agent schemas)
- Prompt + Agent Registry APIs under `/ai`:
  - `GET/POST /ai/prompts`, `GET/PATCH /ai/prompts/:promptId`, `GET/POST /ai/prompts/:promptId/versions`, `POST /ai/prompts/:promptId/versions/:version/activate`, `POST /ai/prompts/:promptId/approval`, `POST /ai/prompts/:promptId/active`
  - `GET/POST /ai/agents`, `GET/PATCH /ai/agents/:agentId`
- prompt/agent permission enforcement reusing `ai.*` (create/edit/configure/approve/manage_ai) with tenant isolation and audit logging
- frontend Prompt Registry screen (`/ai-prompts`, with prompt version view) and Agent Registry screen (`/ai-agents`, with agent detail view), plus navigation entries
- exhaustive Phase 19 validation script `tests/phase19-prompt-agent-registry-exhaustive.mjs`
- prompt registry, AI agent registry, AI governance, and API documentation updates

- Phase 18 migration `20260618050000_phase18_ai_gateway.sql` with tenant-scoped `ai_settings` and append-only `ai_usage_logs`
- AI Gateway as the single entry point for all AI calls, with a provider abstraction in `@crm/ai` and placeholder providers for OpenAI, Anthropic, Azure OpenAI, and a local model
- environment-based AI configuration (`AI_GATEWAY_ENABLED`, `AI_DEFAULT_PROVIDER`, `AI_DEFAULT_MODEL`, `AI_RATE_LIMIT_PER_MINUTE`, and per-provider keys/endpoints)
- managed prompt template registry (`defaultAiPromptTemplates`) so prompts are never hardcoded in business logic
- AI Gateway APIs under `/ai`:
  - `GET/PATCH /ai/settings`, `GET /ai/providers`, `GET /ai/templates`
  - `POST /ai/gateway/execute` (permissioned, tenant-aware, logged, with rate-limit placeholder)
  - `GET /ai/logs`, `GET /ai/usage`
- AI usage logging, AI permission checks, tenant-aware AI usage, and an AI error model (`AI_DISABLED`, `AI_TEMPLATE_NOT_FOUND`, `AI_OVERRIDE_NOT_ALLOWED`)
- AI workspace frontend at `/ai-assistant` with Assistant (gateway execution panel), Settings (admin), and Logs tabs replacing the placeholder
- exhaustive Phase 18 validation script `tests/phase18-ai-gateway-exhaustive.mjs`
- AI architecture, AI gateway design, AI governance, access control guide, and API documentation updates


- Phase 17 migration `20260618030000_phase17_customer_training.sql`
- nine tenant-scoped training tables: `training_programs`, `training_modules`, `training_lessons`, `training_assets`, `training_assignments`, `customer_learners`, `training_progress`, `training_feedback`, and `training_certifications`
- seeded training option sets for category and level
- Training APIs under `/training`:
  - `GET /options`, `GET /dashboard`, `GET /portal/my-training`
  - `GET/POST /learners`
  - `GET/POST /programs`, `GET/PATCH/DELETE /programs/:programId`
  - `POST /programs/:programId/modules`, `PATCH .../modules/:moduleId`
  - `POST .../modules/:moduleId/lessons`, `PATCH .../lessons/:lessonId`, `POST .../lessons/:lessonId/assets`
  - `GET/POST /assignments`, `GET/PATCH /assignments/:assignmentId`
  - `POST /assignments/:assignmentId/progress`, `POST /assignments/:assignmentId/feedback`
- training frontend at `/training` with a program catalog, module/lesson authoring, assignment management, and a learner portal (My Training)
- progress and completion tracking that recomputes assignment completion from lesson progress, plus feedback capture and a training dashboard
- training links to onboarding plans and customer success accounts
- training AI placeholders (AI product trainer, learning path recommender, lesson summarizer, quiz generator, knowledge gap detection) plus role-based path, certification, and recommended-training placeholders
- exhaustive Phase 17 validation script `tests/phase17-customer-training-exhaustive.mjs`
- customer training functional spec, training portal user guide, customer portal user guide, data model, and API documentation updates


- Phase 16 migration `20260618010000_phase16_customer_success.sql`
- nine tenant-scoped customer success tables: `customer_success_accounts`, `onboarding_plans`, `onboarding_milestones`, `success_plans`, `customer_health_scores`, `adoption_metrics`, `qbrs`, `renewals`, and `escalations`
- seeded customer success option sets for segment, risk status, expansion potential, and renewal status (reusing the customer-success-stage set for lifecycle)
- Customer success APIs under `/customer-success`:
  - `GET /options`, `GET /dashboard`, `GET /dashboards/health`, `GET /dashboards/renewal`
  - `GET /workspaces/onboarding`, `GET /workspaces/scaled`, `GET /workspaces/enterprise`
  - `GET /accounts`, `POST /accounts`, `GET/PATCH/DELETE /accounts/:csAccountId`
  - `PUT /accounts/:csAccountId/onboarding-plan`, `PUT /accounts/:csAccountId/success-plan`
  - `POST /accounts/:csAccountId/health-scores`, `POST /accounts/:csAccountId/adoption-metrics`
  - `POST/PATCH /accounts/:csAccountId/qbrs`, `POST/PATCH /accounts/:csAccountId/renewals`, `POST/PATCH /accounts/:csAccountId/escalations`
- customer success frontend at `/customer-success` replacing the placeholder with onboarding, scaled, and enterprise workspaces plus health and renewal dashboards
- health score, adoption score, renewal, QBR/EBR, escalation, and success plan tracking with low-touch and automated check-in placeholders
- customer success AI placeholders (onboarding plan generator, health summary, churn risk, adoption recommendation, QBR/EBR summary, executive account brief, renewal strategy, email draft)
- exhaustive Phase 16 validation script `tests/phase16-customer-success-exhaustive.mjs`
- customer success functional spec, health score design, onboarding/scaled/enterprise playbooks, user guide, data model, and API documentation updates


- Phase 15 migration `20260617090000_phase15_support_ticketing.sql`
- tenant-scoped `support_sla_policies`, `support_tickets`, `support_ticket_messages`, `support_knowledge_articles`, and `support_ticket_articles` tables
- seeded support option sets for ticket priority, category, source, and knowledge category (reusing the existing ticket status set)
- Support ticketing APIs:
  - `GET /support/options`
  - `GET /support/dashboard`
  - `GET /support/sla-policies`, `POST /support/sla-policies`
  - `GET /support/knowledge-articles`, `POST /support/knowledge-articles`
  - `GET /support/tickets`, `POST /support/tickets`
  - `GET /support/tickets/:ticketId`, `PATCH /support/tickets/:ticketId`, `DELETE /support/tickets/:ticketId`
  - `POST /support/tickets/:ticketId/messages` (internal notes and customer replies)
  - `POST /support/tickets/:ticketId/articles` (link knowledge article)
- support frontend at `/support` replacing the placeholder with a ticket dashboard, queue, ticket detail, SLA tracking, conversation, and knowledge base
- SLA policy configuration with first-response and resolution due-date calculation and breach status
- support AI placeholders (ticket classification, suggested response, similar tickets, knowledge recommendation, ticket summary, escalation recommendation)
- attachments, CSAT, and escalation workflow placeholders
- exhaustive Phase 15 validation script `tests/phase15-support-ticketing-exhaustive.mjs`
- new support ticketing functional spec and support user guide, plus data model, API documentation, and module catalog updates


- Phase 14 migration `20260617070000_phase14_reseller_management.sql`
- tenant-scoped `resellers`, `reseller_contacts`, `reseller_onboarding_tasks`, and `reseller_deal_registrations` tables
- seeded reseller option sets for status, pricing tier, margin profile, onboarding status, and deal stage
- Reseller management APIs:
  - `GET /resellers/options`
  - `GET /resellers/dashboard`
  - `GET /resellers`
  - `POST /resellers`
  - `GET /resellers/:resellerId`
  - `PATCH /resellers/:resellerId`
  - `DELETE /resellers/:resellerId`
  - `GET /resellers/:resellerId/deals`
  - `POST /resellers/:resellerId/deals`
  - `PATCH /resellers/:resellerId/deals/:dealId`
- Reseller management frontend route `/resellers` with reseller dashboard, list, detail, onboarding checklist, and deal registration views
- reseller AI placeholders (performance insight, sales prediction, margin optimization, opportunity recommendation, inactivity alert, coaching recommendation)
- reseller catalog, order tracking, training, certification, and support tickets placeholders
- exhaustive Phase 14 validation script `tests/phase14-reseller-management-exhaustive.mjs`
- new reseller manager user guide plus partner/reseller functional spec, data model, and API documentation updates


- Phase 13 migration `20260617050000_phase13_partner_channel_management.sql`
- tenant-scoped `partners`, `partner_contacts`, `partner_onboarding_tasks`, and `partner_deal_registrations` tables
- seeded partner option sets for partner type, tier, status, onboarding status, and deal stage
- Partner channel APIs:
  - `GET /partners/options`
  - `GET /partners/dashboard`
  - `GET /partners`
  - `POST /partners`
  - `GET /partners/:partnerId`
  - `PATCH /partners/:partnerId`
  - `DELETE /partners/:partnerId`
  - `GET /partners/:partnerId/deals`
  - `POST /partners/:partnerId/deals`
  - `PATCH /partners/:partnerId/deals/:dealId`
- Partner channel frontend route `/partners` with partner dashboard, list, detail, onboarding checklist, and deal registration views
- partner AI placeholders (fit score, performance summary, action plan, churn risk, conflict detection)
- partner enablement assets, training linkage, and support tickets placeholders
- exhaustive Phase 13 validation script `tests/phase13-partner-channel-exhaustive.mjs`
- new partner/reseller functional spec and partner manager user guide, plus module catalog, data model, and API documentation updates


- Phase 12 migration `20260617030000_phase12_business_development_presales.sql`
- tenant-scoped `bd_target_accounts`, `bd_account_stakeholders`, `presales_requests`, and `presales_requirements` tables
- new `business_development` permission module plus seeded option sets for BD account tier, BD pipeline stage, BD partnership type, presales request type, and presales request status
- Business Development APIs:
  - `GET /business-development/options`
  - `GET /business-development`
  - `POST /business-development`
  - `GET /business-development/:targetAccountId`
  - `PATCH /business-development/:targetAccountId`
  - `DELETE /business-development/:targetAccountId`
- Presales APIs:
  - `GET /presales/options`
  - `GET /presales`
  - `POST /presales`
  - `GET /presales/:requestId`
  - `PATCH /presales/:requestId`
  - `DELETE /presales/:requestId`
- Business Development and Presales frontend routes:
  - `/business-development`
  - `/presales`
- strategic account targeting, relationship/executive mapping, BD pipeline, presales intake, RFP/RFI requirement tracker, and proposal workspace surfaces
- BD and presales AI placeholders (account research brief, stakeholder map, RFP extraction, compliance matrix, demo script, proposal response draft, technical risk detection)
- exhaustive Phase 12 validation script `tests/phase12-business-development-presales-exhaustive.mjs`
- updated functional, module catalog, data model, API, and sales-guide documentation for the BD and presales rollout

- Phase 11 SDR and inside-sales workspace APIs:
  - `GET /sales-workspaces/options`
  - `GET /sales-workspaces/sdr`
  - `GET /sales-workspaces/inside-sales`
  - `PATCH /sales-workspaces/leads/:leadId/workflow`
- SDR and inside-sales frontend routes:
  - `/sales/sdr`
  - `/sales/inside-sales`
- shared lead-workspace workbench UI for qualification, handoff, and task creation
- seeded lead workspace option sets for outreach status, handoff status, and call disposition
- exhaustive Phase 11 validation script `tests/phase11-sales-workspaces-exhaustive.mjs`
- updated functional, API, sales-guide, README, and version documentation for the sales workspace rollout

- Phase 10 migration `20260617010000_phase10_sales_pipeline.sql`
- tenant-scoped `opportunities` and `opportunity_stakeholders` tables
- opportunity CRUD APIs with options, dashboard metrics, stage-aware updates, and tenant-safe stakeholder linkage
- opportunity frontend for:
  - list
  - detail
  - create and edit form
  - sales metrics cards
  - Kanban pipeline
  - stage distribution
  - permission-aware AI placeholders
- exhaustive Phase 10 validation script `tests/phase10-opportunities-exhaustive.mjs`
- opportunity coverage in functional, technical, API, and sales documentation

- Phase 9 migration `20260616233000_phase9_social_media_marketing.sql`
- tenant-scoped `social_posts` and `social_post_channels` tables
- social post CRUD APIs
- social channels API and social options API
- social frontend for:
  - dashboard
  - content calendar
  - list
  - detail
  - create and edit form
  - approval status UI
  - campaign linkage
  - permission-aware AI placeholders
- social media marketing coverage in functional, technical, and marketing documentation

- Phase 8 migration `20260616190000_phase8_campaign_management.sql`
- tenant-scoped `campaigns` and `campaign_members` tables
- campaign CRUD APIs
- campaign member APIs for leads, contacts, and accounts
- campaign options API backed by seeded tenant option sets
- shared record APIs for:
  - notes read
  - activities read
  - campaign support across notes, activities, tasks, and timeline
- campaign frontend for:
  - dashboard placeholder
  - list
  - detail
  - create and edit form
  - member management
  - calendar placeholder
  - permission-aware AI placeholders
- new campaign functional specification and marketing user guide

### Changed

- platform metadata now reflects Phase 11: SDR and Inside Sales Workspace
- the dashboard now highlights SDR and inside-sales execution readiness alongside pipeline, campaign, and social modules
- sales-facing navigation now includes dedicated SDR and inside-sales workspace entries
- platform metadata now reflects Phase 10: Sales Pipeline and Opportunity Management
- tenant option sets and form-layout metadata now include opportunity sources, outcome statuses, and a default opportunity layout
- the shared CRM record engine now resolves `opportunity` against a live primary table instead of a future placeholder
- account detail guidance now points users to the live Opportunities workspace for account-linked revenue tracking
- platform metadata now reflects Phase 9: Social Media Marketing Module
- tenant option sets and form-layout metadata now include social channels, post statuses, approval statuses, and a default social layout
- the social module now replaces a previously vocabulary-only shell with a live PostgreSQL-backed workspace
- high-level repository phase references now include the social media marketing module
- platform metadata now reflects Phase 8: Campaign Management and Marketing Foundation
- shared CRM productivity tables now accept `campaign` as a supported record type
- campaign option sets and campaign form-layout metadata are now part of the default tenant seed
- the old campaign placeholder route has been replaced with a real module wired to PostgreSQL and RBAC
- data model, module catalog, API docs, and user-facing docs now reflect the live campaign module

### Security

- sales workspace routes now enforce module-aware RBAC checks and assigned-lead visibility for non-manager roles
- owner reassignment from sales workspaces now remains assign-aware while workflow edits stay available to contributor roles with edit access
- workspace writes remain tenant-scoped and audit logged, including `lead.workspace.update` and `lead.handoff.update`
- opportunity routes now enforce module-aware RBAC checks
- opportunity owner updates enforce assign-aware authorization rules
- opportunity stage updates enforce approval and workflow-aware authorization rules
- opportunity writes remain tenant-scoped and audit logged, including stage-change audit events and timeline activities
- social routes now enforce module-aware RBAC checks
- social owner and campaign linkage updates enforce assign-aware authorization rules
- social approval updates enforce approval-aware authorization rules
- social post writes remain tenant-scoped and audit logged
- campaign routes now enforce module-aware RBAC checks
- campaign owner updates and member lifecycle mutations enforce assign-aware authorization rules
- campaign, campaign-member, note, activity, and task writes remain tenant-scoped and audit logged

### Notes

- email sequencing, meeting booking, MEDDIC execution, and AI-powered workspace actions remain placeholders in this phase
- products and services, forecast modeling, deal risk scoring, next-best-action logic, proposal drafting, and win probability remain placeholders in this phase
- social publishing, engagement ingestion, listening, competitor benchmarks, and social lead capture remain placeholders in this phase
- ticket and customer-success-account primary tables are still future work
- campaign performance analytics, attribution, and true scheduling remain placeholders in this phase
- the campaign foundation is now live and ready for later marketing automation, attribution, and AI Gateway integration
