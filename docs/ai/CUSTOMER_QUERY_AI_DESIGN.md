# Customer Query AI Design

## Purpose

This document defines how AI-assisted customer or user query handling should work within the platform. It focuses on safe response generation, routing, escalation, and knowledge use rather than on unrestricted chatbot behavior.

## Scope

This document covers:
- supported query use cases
- processing flow
- response patterns
- guardrails and escalation rules
- implementation guidance

This document does not cover:
- final channel integrations
- UI chat design
- provider-specific prompt content

## Objectives

- answer approved questions more effectively with knowledge grounding
- reduce response time for support, onboarding, and success teams
- preserve policy and data boundaries during AI interactions
- escalate appropriately when AI should not answer directly

## Supported Use Cases

- product usage questions
- support guidance and draft assistance
- onboarding and training queries
- account or case summarization for internal users
- routing ambiguous questions to the right function

## Query Processing Flow

1. receive query with tenant, actor, and channel context
2. classify intent and sensitivity
3. determine whether direct answer, retrieval, or escalation is appropriate
4. resolve prompt and execution policy through the AI Gateway
5. retrieve approved knowledge where needed
6. generate answer or next-best action
7. log the interaction and any escalation outcome

## Response Modes

### Direct Informational Response

Use when the answer can be grounded in approved knowledge and policy allows direct output.

### Guided Clarification

Use when the request lacks sufficient detail and a clarifying question is safer than guessing.

### Assisted Internal Draft

Use when a human operator should review or send the final response.

### Escalation

Use when:
- confidence is low
- the question touches restricted or ambiguous data
- the workflow requires human ownership

## Guardrails

- do not fabricate account-specific facts
- do not reveal cross-tenant or unauthorized information
- do not take sensitive actions without explicit policy support
- prefer escalation when knowledge confidence or policy confidence is insufficient

## Module Touchpoints

- support ticketing
- onboarding workflows
- training content access
- customer success context
- knowledge sources and RAG
- AI Gateway, prompts, and agents

## Success Metrics

- usefulness of answers
- escalation precision
- retrieval relevance
- policy compliance
- time saved for customer-facing teams

## Implementation Guidance

When implementation begins:
- start with internal-assist use cases before autonomous external responses
- define channel-specific behavior only after core policy flow is stable
- log query classification and escalation decisions for review
- ensure every response path can explain whether it used retrieval, direct prompting, or agent logic
- validate the design with realistic high-risk scenarios before broad rollout

## Phase 20 Foundation

The retrieval foundation that customer-query AI will build on is implemented as of Phase 20.

- **Grounded retrieval** — the Customer Query Resolution agent (Phase 19) will answer from the RAG knowledge base via `POST /ai/rag/retrieve`, which returns cited sources rather than free-form text.
- **Permission-aware answers** — retrieval already filters by knowledge-source permissions, so an answer can only cite content the requester is allowed to see. Customer-specific documents are a `restricted` source gated by `customer_success.view`.
- **Approved knowledge only** — only `approved` and `published` knowledge articles are retrievable, keeping unreviewed content out of customer-facing answers.
- **Knowledge gaps** — queries that retrieve nothing are logged to `knowledge_gaps`, seeding the gap-analysis loop that flags missing customer-facing content.

The runtime that classifies queries, chooses retrieval vs. direct prompting, drafts responses, and enforces escalation remains future work; Phase 20 delivers the grounded, governed retrieval substrate it depends on. See [RAG_ARCHITECTURE.md](./RAG_ARCHITECTURE.md).

## Phase 21 Implementation — Customer AI Query Bot

The customer query bot is implemented as of Phase 21, built on the Phase 20 RAG foundation.

### Rules enforced

- **Approved knowledge only / retrieve-before-answer** — every question runs `RagService.retrieve` first; answers are composed solely from the returned citations. No retrieval, no answer.
- **Grounded, no hallucination** — the answer text is built from retrieved snippets; with zero citations the bot says it has no approved answer rather than inventing one.
- **Escalate on low confidence / Level 3** — a confidence score is computed from retrieval; queries below the threshold, Level 3 queries, and no-answer queries are escalated.
- **Tenant + permission aware** — retrieval is tenant-scoped and gated by knowledge-source permissions, so an answer only cites content the requester may access.
- **Logged** — every question and answer is written to `customer_query_messages`; sessions, escalations, and audit logs capture the rest.

### Query levels

Queries are classified by keyword heuristics into Level 1 (simple how-to, password reset, navigation, basic config), Level 2 (workflow/permission/dashboard/assignment/configuration troubleshooting), and Level 3 (outage, data corruption, security, billing, contract, integration failure, critical, custom development). **Level 3 always escalates.**

### Data model

- `customer_query_sessions` — a conversation (subject, channel, status, escalation level, last confidence, related ticket).
- `customer_query_messages` — append-only customer/assistant turns with `query_level`, `confidence_score`, `is_grounded`, `escalated`, `citations`, and `feedback` (`pending`/`helpful`/`not_helpful`).
- `customer_query_escalations` — escalation records (`low_confidence`/`level_3`/`no_answer`/`customer_request`) linked to a support ticket when one is created.

### Flow

1. `POST /customer-query/ask` — create/continue a session, classify level, retrieve approved sources, compute confidence, compose a grounded answer, log both turns.
2. **Escalation** — Level 3 and no-answer queries create an escalation and a support ticket (reusing the Phase 15 `support_tickets` schema); low-confidence queries create an escalation for human review.
3. **Feedback** — `POST /customer-query/sessions/:id/feedback` records helpful/not helpful.
4. **Knowledge gaps** — no-result queries are logged to `knowledge_gaps` (via retrieval) for the gap dashboard.
5. **Review** — support/customer success use `GET /customer-query/sessions`, `/dashboard`, and `/knowledge-gaps`.

Live LLM generation is still deferred; the bot composes deterministic grounded answers from retrieved snippets so the governance, escalation, ticketing, and logging mechanisms run end-to-end. See [AI_GOVERNANCE.md](./AI_GOVERNANCE.md).
