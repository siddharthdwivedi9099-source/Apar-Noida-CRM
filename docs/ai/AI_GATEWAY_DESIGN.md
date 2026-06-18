# AI Gateway Design

## Purpose

The AI Gateway is the central control plane for AI usage in the platform. This document defines its role, boundaries, required behaviors, and implementation expectations.

## Scope

This document covers:
- gateway responsibilities
- request and response expectations
- policy and routing controls
- observability and failure handling
- implementation guidance

This document does not cover:
- concrete provider adapters
- final runtime framework
- end-user screen behavior

## Role of the Gateway

The gateway should be the single entry point for all AI execution initiated by product features, workflows, and future external channels.

It exists to provide:
- control
- consistency
- auditability
- usage visibility
- tenant-safe execution

## Responsibilities

### Policy Enforcement

- validate whether an AI request is allowed
- enforce tenant-aware and role-aware behavior
- verify model, prompt, and agent eligibility

### Prompt and Agent Resolution

- resolve prompts by versioned reference
- resolve agent definitions and tool permissions
- attach execution metadata for audit and replay analysis

### Model Routing

- select the appropriate provider and model for the use case
- support future fallback policies
- preserve routing traceability

### Safety and Governance

- apply safety checks or moderation steps where required
- block disallowed tool paths
- support stronger review rules for high-impact actions

### Telemetry and Cost Visibility

- record usage, latency, errors, and routing details
- support chargeback, tenant metering, or budget visibility

## Required Request Inputs

- tenant identifier
- actor identifier
- use-case or workflow identifier
- prompt reference or agent reference
- sensitivity level
- optional knowledge or tool requirements
- optional response mode expectations

## Required Response Outputs

- response payload
- resolved prompt and model metadata
- policy or moderation outcome metadata
- trace and request identifiers
- usage and latency details

## Control Points

The gateway should expose control points for:
- pre-execution validation
- provider/model selection
- retrieval authorization checks
- tool invocation allowlists
- output filtering or review
- usage logging and cost tracking

## Failure Modes to Plan For

- provider timeouts
- provider quota or availability issues
- invalid prompt or agent references
- retrieval access denial
- tool execution refusal
- moderation or policy blocks

## Operational Expectations

- low-latency support for interactive requests
- asynchronous support for long-running jobs
- deterministic logging of execution choices
- graceful degradation when providers fail

## Implementation Guidance

When implementation begins:
- define a stable request contract first
- keep provider adapters behind internal abstractions
- avoid mixing business-specific logic into gateway internals
- require tracing and request IDs from the first implementation
- design the gateway so policy changes are reviewable and testable

## Phase 18 Implementation

### Endpoints (`/ai`)

- `GET /ai/settings` — tenant AI settings (auto-created on first access)
- `PATCH /ai/settings` — update settings (requires `ai.configure`/`ai.manage_ai`)
- `GET /ai/providers` — provider abstraction status (configured per environment, default provider, gateway enabled)
- `GET /ai/templates` — the managed prompt template registry
- `POST /ai/gateway/execute` — the single execution entry point (requires `ai.use_ai`)
- `GET /ai/logs` — paginated AI usage logs (filters: provider, status, templateKey)
- `GET /ai/usage` — usage summary (totals, provider/status distributions, tokens)

### Execution flow

1. Permission check (`ai.use_ai`) at the router.
2. Resolve tenant `ai_settings` (create defaults if missing).
3. If the gateway or tenant AI is disabled → log `denied`, audit, return `403 AI_DISABLED`.
4. Resolve the prompt template by `templateKey` (→ `400 AI_TEMPLATE_NOT_FOUND` if unknown).
5. Enforce override policy — a `providerKey`/`model` override without `allowUserOverrides` → `403 AI_OVERRIDE_NOT_ALLOWED`.
6. Select provider (override or tenant default) and model; resolve `{{variables}}` into the prompt.
7. Report the rate-limit placeholder (limit advertised, not enforced).
8. Call the provider, which returns a governed placeholder result.
9. Write an `ai_usage_logs` row (if logging enabled) and an audit-log entry.
10. Return the structured `AiGatewayResponse` with status, output, usage, latency, rate limit, and governance fields.

### Data

- `ai_settings` — one row per tenant: `is_enabled`, `default_provider`, `default_model`, `rate_limit_per_minute`, `allow_user_overrides`, `redaction_enabled`, `logging_enabled`.
- `ai_usage_logs` — append-only per-tenant request log.
