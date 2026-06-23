# AI Governance

## Purpose

This document describes how AI use is governed in the platform following the Phase 18 AI Gateway foundation.

## Principles

- **Single governed entry point.** All AI calls pass through the AI Gateway (`POST /ai/gateway/execute`). No business module calls a provider directly.
- **No hardcoded prompts.** Prompts live in the managed template registry (`defaultAiPromptTemplates`). Callers reference a `templateKey` and supply variables; prompt text is never embedded in business logic.
- **Tenant isolation.** AI settings and usage logs are scoped per tenant. One tenant cannot see or affect another tenant's AI configuration or logs.
- **Least privilege.** AI capabilities are permissioned:
  - `ai.use_ai` (or `ai.manage_ai`/`ai.configure`) to execute through the gateway.
  - `ai.configure` / `ai.manage_ai` to change tenant AI settings.
  - `ai.view` / `ai.view_dashboard` / `ai.manage_ai` / `ai.configure` to read usage logs and the usage summary.
- **Auditability.** Every gateway execution and settings change writes an audit-log entry, and every request writes an `ai_usage_logs` row (provider, model, template, status, tokens, latency, errors).

## Controls

- **Enablement.** AI can be disabled per tenant (`ai_settings.is_enabled`) and globally (`AI_GATEWAY_ENABLED`). When disabled, requests are denied and logged.
- **Provider/model overrides.** Disabled by default (`allow_user_overrides = false`); a request supplying a provider or model override is rejected unless overrides are enabled.
- **Rate limiting.** A per-minute limit is configured (`rate_limit_per_minute`) and advertised in responses. Enforcement is a placeholder in this phase.
- **Redaction.** `redaction_enabled` flags the intent to redact sensitive content; the redaction pipeline is deferred.
- **Logging.** `logging_enabled` controls whether usage rows are written.

## Deferred execution

Providers are placeholders in this phase and return governed deferred responses (status `placeholder`). Live model execution requires provider credentials and a later execution phase. This lets the governance, permissioning, tenant-awareness, and logging mechanisms be exercised end-to-end before any external model is called.

## Prompt and Agent Governance (Phase 19)

The Prompt Registry and AI Agent Registry extend governance from runtime calls to the managed assets themselves.

### Prompt Registry

- **Versioned prompts.** Every prompt has an immutable version history (`ai_prompt_versions`). Editing content creates a new version; older versions are never mutated.
- **Approval workflow.** Prompts carry an `approval_status` (`draft` → `pending_review` → `approved`/`rejected`). A prompt cannot be activated (`is_active = true`) until its current version is `approved` — activation of an unapproved prompt is rejected (`AI_PROMPT_NOT_APPROVED`).
- **Schemas and guardrails.** Each prompt declares an input schema, an output schema, and a list of guardrails so prompt contracts are explicit and reviewable.
- **Permissions.** `ai.create`/`ai.configure`/`ai.manage_ai` to create, `ai.edit`/`ai.configure`/`ai.manage_ai` to edit and version, `ai.configure`/`ai.manage_ai` to activate versions or the prompt, `ai.approve`/`ai.configure`/`ai.manage_ai` to change approval status. Any `ai.*` permission can read.
- **Audit and authorship.** `created_by`/`updated_by` are tracked on prompts and versions, and every create/edit/version/activate/approval action writes an audit-log entry.

### AI Agent Registry

- **Sixteen baseline agents.** A governed baseline (Sales Copilot, Marketing Copilot, Social Media, SDR Assistant, Presales Proposal, Support Resolution, three Customer Success agents, Customer Training, Customer Query Resolution, Partner Manager, Reseller Growth, Executive Insight, Data Quality, Workflow Automation) is provisioned per tenant on first access and marked as system agents.
- **Bounded authority.** Each agent declares `allowed_tools`, `allowed_roles`, a `data_access_scope` (`own`/`team`/`module`/`tenant`), a `requires_human_approval` flag, and `escalation_rules`. Agents are configuration, not autonomous executors.
- **Status and logging.** Agents have a `status` (`draft`/`active`/`inactive`) and a `logging_enabled` flag.
- **Tenant isolation.** Agents and prompts are tenant-scoped; one tenant cannot read or configure another tenant's registry entries.
- **Permissions.** `ai.create`/`ai.configure`/`ai.manage_ai` to create, `ai.edit`/`ai.configure`/`ai.manage_ai` to configure, any `ai.*` permission to read.

See [PROMPT_REGISTRY.md](./PROMPT_REGISTRY.md) and [AI_AGENT_REGISTRY.md](./AI_AGENT_REGISTRY.md) for the full data model and API surface.

## Knowledge and Retrieval Governance (Phase 20)

The RAG Knowledge System extends governance to the corpus AI retrieves from.

- **Permission-aware retrieval.** Knowledge sources declare an `access_scope` and an optional `required_permission`. Retrieval (`POST /ai/rag/retrieve`) only draws from sources the actor may access; restricted sources (e.g. customer-specific documents, resolved tickets, admin guides) are excluded for users without the gating permission and reported as a restricted count.
- **Tenant isolation.** Sources, documents, chunks, articles, and gaps are tenant-scoped; retrieval never crosses tenants.
- **Approved knowledge only.** Knowledge articles are versioned and approval-gated (`draft`/`pending_review`/`approved`/`archived`) and must be `approved` and `published` before retrieval can return them (`KNOWLEDGE_ARTICLE_NOT_APPROVED` guards premature publishing).
- **Citations.** Every retrieval result is attributable to a source plus a document/chunk or article, so answers can be traced to their origin.
- **Deferred embeddings.** Embedding generation (through the AI Gateway) and vector storage are placeholders; chunks carry an embedding status and a vector reference, and retrieval advertises `deferred: true`. This exercises governance end-to-end before any external model or vector store is wired in.
- **Knowledge gaps.** Queries that retrieve nothing are logged to `knowledge_gaps` for review.
- **Permissions.** Read uses any `ai.*`; create/edit/approve reuse `ai.create`/`ai.edit`/`ai.approve`/`ai.configure`/`ai.manage_ai`; retrieval requires `ai.use_ai`/`ai.view`/`ai.view_dashboard`/`ai.manage_ai`/`ai.configure`. All knowledge mutations and retrieval are audited.

See [RAG_ARCHITECTURE.md](./RAG_ARCHITECTURE.md) for the data model and pipeline.

## Customer Query AI Governance (Phase 21)

The Customer AI Query Bot answers customer-facing questions under strict guardrails.

- **Grounded answers only.** The bot retrieves approved knowledge (via the Phase 20 RAG retrieval) before answering and composes answers solely from the returned citations. With no citations it declines and escalates rather than hallucinating.
- **Permission- and tenant-aware.** Retrieval respects knowledge-source permissions and tenant isolation, so an answer can only cite content the requester is allowed to see.
- **Confidence and escalation.** A confidence score is computed per answer. Low-confidence answers, Level 3 questions (outage, data corruption, security, billing, contract, integration failure, critical, custom development), and no-answer cases are escalated; Level 3 and no-answer cases also open a support ticket.
- **Full logging.** Every question and answer is logged to `customer_query_messages`, with sessions, escalations, audit-log entries, and knowledge-gap records.
- **Feedback loop.** Customers mark answers helpful/not helpful, and unanswered queries become tracked knowledge gaps for review.
- **Permissions.** Asking requires `customer_query.use_ai`/`create`/`manage_ai`/`configure`; review/dashboard requires `customer_query.view`/`view_dashboard`/`manage_ai`/`assign`/`configure`/`edit`.

See [CUSTOMER_QUERY_AI_DESIGN.md](./CUSTOMER_QUERY_AI_DESIGN.md) for the full design.

## Module AI Action Governance (Phase 22)

Module AI actions integrate AI into every CRM module under a fixed set of rules, enforced by `AiActionsService`:

1. **Permission checked** — each action declares the permissions allowed to run it (a module permission or `ai.use_ai`/`ai.manage_ai`); execution is rejected otherwise.
2. **Request and response logged** — every run writes an `ai_action_runs` row (action, module, variables, resolved prompt, output, provider/model, tokens, review state) plus the gateway's `ai_usage_logs` entry and an audit-log record.
3. **Prompt Registry used** — every action resolves its prompt from the managed registry via a `templateKey`; prompts are never hardcoded in business logic or the UI.
4. **AI Gateway used** — every action executes through the AI Gateway, inheriting its tenant settings, provider abstraction, and deferred-execution placeholder behavior.
5. **Human review for sensitive actions** — drafts, recommendations, and generators are flagged `sensitive` and returned as `pending_review`; the output is not considered usable until an authorized reviewer (`<module>.approve`/`manage_ai`/`configure` or `ai.approve`/`manage_ai`) approves it.
6. **Tenant isolation** — `ai_action_runs` are tenant-scoped; runs from one tenant are never visible to another.

See [AI_USE_CASE_CATALOG.md](./AI_USE_CASE_CATALOG.md) for the catalog and [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md) for the composition.

## Known Governance Gaps (2026-06-23 review)

The security review confirmed the governance controls above and recorded these gaps to address before enabling live provider execution:
- **Rate limiting is reported but not enforced.** The gateway returns the per-tenant `rate_limit_per_minute` with `enforced: false`. Enforcement must be implemented before live providers are enabled, to bound cost and abuse.
- **Redaction flag without enforced redaction.** `redaction_enabled` is stored per tenant, but redaction is not yet applied to provider payloads. Treat it as configuration intent only until enforcement lands.
- **Provider execution is deferred.** Calls return deterministic placeholders (`result.placeholder`), so prompt-injection execution risk is currently low. Re-run the AI sections of [../security/SECURITY_REVIEW_REPORT.md](../security/SECURITY_REVIEW_REPORT.md) before enabling any live provider.

RAG retrieval already enforces source-level permissions (`required_permission`), tenant scoping, and approved/published-only results, and is audit-logged.
