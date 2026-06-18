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
