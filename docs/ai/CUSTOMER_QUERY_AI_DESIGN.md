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
