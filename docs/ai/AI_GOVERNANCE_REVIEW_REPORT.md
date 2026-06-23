# AI Governance Review Report

**Review date:** 2026-06-24
**Release reviewed:** v1.0.0 (`main`)
**Scope:** Governance of all AI surfaces — AI Gateway, Prompt Registry, AI Agent Registry, AI Actions, RAG retrieval, and the customer-facing Customer Query bot.
**Method:** Each of the 17 areas below was assessed by reading the implementing code, not documentation.

## Executive Summary

The platform's AI governance posture is **strong and consistently enforced**. Every AI call routes through a single governed gateway; prompts come exclusively from a versioned, permissioned registry; the customer-facing bot is **extractive (grounded in approved sources), not generative**, so it cannot hallucinate free-form answers or be used as a prompt-injection execution surface; sensitive generative actions require human review; and every AI interaction is tenant-scoped and audit-logged.

One concrete governance hardening was **applied** during this review: caller-supplied prompt-variable values are now sanitized (control characters stripped, template delimiters neutralized, length clamped) before interpolation into managed templates. No critical governance gaps remain unaddressed; the residual risks below are cost/operational and become relevant only when live AI providers are enabled (provider execution is currently a deterministic placeholder).

| Severity | Found | Fixed | Documented |
|----------|-------|-------|------------|
| Critical | 0 | 0 | 0 |
| High | 0 | 0 | 0 |
| Medium | 2 | 0 | 2 |
| Low | 3 | 1 (prompt-variable sanitization) | 3 |

## Area-by-Area Assessment

| # | Area | Status | Evidence |
|---|------|--------|----------|
| 1 | AI Gateway usage | ✅ Strong | `ai-gateway.service.ts execute()` is the single entry; AI actions and customer flows route through it. Disabled-tenant and template-not-found paths fail closed with audit logging. |
| 2 | Prompt Registry usage | ✅ Strong | Prompts resolve from `defaultAiPromptTemplates`/DB by `templateKey`; versioned (`current_version`/`latest_version`) with separate create/edit/activate/**approve** permissions; never hardcoded in business logic. |
| 3 | AI Agent Registry usage | ✅ Strong | `ai_agents` are tenant-scoped and declare `allowed_tools`, `allowed_roles`, `data_access_scope`, `requires_human_approval`, `logging_enabled`, and `escalation_rules`; mutations are permission-gated and audit-logged. |
| 4 | AI logs | ✅ Strong | `ai_usage_logs` (gateway), `ai_action_runs` (actions, with resolved prompt + output + tokens), `customer_query_messages` (with citations/confidence), all plus `audit_logs`. |
| 5 | AI permissions | ✅ Strong | `ai.use_ai`/`manage_ai`/`configure`/`approve`/`create`/`edit` and per-module `customer_query.*`; checked on every execute/review/configure path. |
| 6 | Tenant-aware AI | ✅ Strong | `ai_settings` per tenant; every log, run, agent, prompt, and query row carries and filters by `tenant_id`. |
| 7 | RAG grounding | ✅ Strong | The customer bot **must** call `ragService.retrieve()` before answering; the answer is built only from retrieved snippets. No citations → it escalates instead of fabricating. |
| 8 | Source citations | ✅ Strong | Answers list each source (`sourceName` + `snippet`); citations are persisted on the message and returned to the caller. |
| 9 | Customer-facing AI safety | ✅ Strong | Extractive answers from approved, permission-filtered sources only; permission-gated (`customer_query.use_ai`); session access restricted to owner/reviewer; escalation + ticketing + audit. |
| 10 | Query escalation rules | ✅ Strong | `classifyLevel` (L1/L2/L3 keyword classification); L3 always escalates, no-answer escalates, low-confidence escalates; L3/no-answer auto-create a support ticket. |
| 11 | Low-confidence handling | ✅ Strong | `computeConfidence()` from citation scores/count; below `LOW_CONFIDENCE_THRESHOLD` (0.4) the answer is escalated and flagged. |
| 12 | Prompt injection defense | ✅ Hardened | Customer bot is extractive (no LLM execution surface). Generative gateway now sanitizes variable values (control chars, `{{ }}` delimiters, length). NL-level injection is mitigated by managed templates + human review (see R2/R3 before live providers). |
| 13 | Hallucination prevention | ✅ Strong | Customer answers are extractive from approved sources; `is_grounded` recorded; absent grounding triggers escalation, never invention. |
| 14 | Human approval for sensitive actions | ✅ Strong | `ai-actions` flags `sensitive` actions as `pending_review`; `reviewRun` requires the action's review permissions and only transitions from `pending_review`. Agents carry `requires_human_approval`. |
| 15 | AI feedback capture | ✅ Present | `submitFeedback` stores `helpful`/`not_helpful` + note per answer; the dashboard aggregates helpful/not-helpful counts. |
| 16 | AI response auditability | ✅ Strong | Every gateway/action/agent/prompt/query operation writes an `audit_logs` row (`event_type = 'ai'`); runs persist resolved prompt, output, provider/model, and tokens. |
| 17 | Knowledge gap tracking | ✅ Present | RAG logs unanswered queries to `knowledge_gaps` (`gapLogged`); `listKnowledgeGaps` surfaces them with occurrence counts for review. |

## Fix Applied This Review

### F1 (Low → defense-in-depth) — Prompt-variable sanitization
- **Where:** `apps/api/src/modules/ai/ai-gateway.service.ts` (`resolvePrompt` / new `sanitizePromptVariable`).
- **Change:** Before a caller-supplied variable is interpolated into a managed prompt template, control characters are stripped, the `{{`/`}}` template delimiters are neutralized (a value can never introduce template tokens), and the value is clamped to 8000 characters.
- **Why:** Defense-in-depth against prompt-stuffing/abuse and template-token smuggling. It is the single chokepoint for every generative path (AI Actions and the gateway router), so all callers inherit the guard.

## Documented Risks (Residual)

- **R1 (Medium) — AI gateway rate limit not enforced.** `rate_limit_per_minute` is reported with `enforced: false`. Implement enforcement before enabling live providers to bound cost/abuse. (Also tracked in the security review as M-1.)
- **R2 (Medium) — Redaction flag without enforced redaction.** `redaction_enabled` is stored per tenant but redaction is not applied to provider payloads; treat as intent only until enforcement lands.
- **R3 (Low) — Live provider execution deferred.** Providers return deterministic placeholders, so NL-level prompt-injection and output-validation controls are unexercised. Re-run areas 12–13 of this review before enabling any live provider.
- **R4 (Low) — Customer-query thresholds are hardcoded.** `LOW_CONFIDENCE_THRESHOLD` (0.4) and the escalation keyword lists are constants, not tenant-configurable. Acceptable now; consider tenant config later.
- **R5 (Low) — Rejected action output is retained.** A `rejected` `ai_action_run` still stores/returns its output; consumers must honor `reviewStatus` and not use rejected output. Enforced by contract, not by withholding.

## Verification
- Typecheck: pass (all workspaces)
- API tests: 88 passed (incl. `ai-gateway` and `customer-query-escalation`) · Web tests: 16 passed
- Release-readiness and deployment-artifact gates: pass

See also: [AI_GOVERNANCE.md](./AI_GOVERNANCE.md), [CUSTOMER_QUERY_AI_DESIGN.md](./CUSTOMER_QUERY_AI_DESIGN.md), [RAG_ARCHITECTURE.md](./RAG_ARCHITECTURE.md), [AI_GATEWAY_DESIGN.md](./AI_GATEWAY_DESIGN.md), [PROMPT_REGISTRY.md](./PROMPT_REGISTRY.md), [../security/SECURITY_REVIEW_REPORT.md](../security/SECURITY_REVIEW_REPORT.md).
