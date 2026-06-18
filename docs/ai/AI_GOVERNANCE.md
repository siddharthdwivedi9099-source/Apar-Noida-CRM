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
