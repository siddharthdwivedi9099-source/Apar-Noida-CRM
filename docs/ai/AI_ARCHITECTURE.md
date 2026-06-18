# AI Architecture

## Purpose

This document defines the architecture for AI capabilities across the platform. Its purpose is to ensure that AI features are introduced as governed platform services rather than as isolated model calls embedded throughout product modules.

## Scope

This document covers:
- AI platform principles
- core AI components
- request lifecycle
- control and governance expectations
- implementation guidance for future phases

This document does not cover:
- provider-specific SDK details
- prompt content
- final model selection
- deployment code

## AI Platform Objectives

- centralize model access and policy enforcement
- preserve tenant and role boundaries throughout AI execution
- make prompts, agents, and retrieval assets versioned and reviewable
- support observability, cost tracking, and evaluation
- enable safe AI augmentation across multiple business modules

## Architectural Principles

### Centralized AI Access

No production feature should call an external model provider directly. All requests should flow through the AI Gateway or future equivalent orchestration layer.

### Governed Artifacts

Prompts and agents should be managed as versioned assets rather than inline implementation details.

### Tenant-Aware Execution

Every AI request must carry tenant, actor, use-case, and policy context.

### Retrieval With Authorization

Knowledge retrieval should be treated as an access-controlled data operation, not just a relevance problem.

### Measurable Quality

AI behaviors should be observable through logs, traces, and evaluation outcomes rather than judged only by anecdotal use.

## Core Components

### AI Gateway

Provides:
- model routing
- policy checks
- safety controls
- usage metering
- execution telemetry

### Prompt Registry

Provides:
- versioned prompt storage
- ownership and lifecycle controls
- evaluation references
- controlled rollout support

### Agent Registry

Provides:
- agent definitions
- tool permissions
- execution policies
- lifecycle governance

### Retrieval Layer

Provides:
- knowledge ingestion coordination
- search and ranking
- access-aware context assembly
- provenance tracking

### Evaluation and Monitoring Layer

Provides:
- regression detection
- quality comparison across versions
- safety review support
- operational reporting

## High-Level AI Request Lifecycle

1. A module or user initiates an AI request
2. The request includes tenant, actor, and use-case metadata
3. The AI Gateway resolves the policy, prompt, and routing path
4. Optional retrieval or agent orchestration is executed under policy
5. The model response is returned through controlled post-processing
6. Logs, traces, and usage metadata are recorded
7. Relevant outcomes can be evaluated against quality and safety expectations

## AI Capability Categories

### Assistive AI

- summarization
- draft generation
- query answering
- next-best-action suggestions

### Retrieval-Backed AI

- knowledge-grounded answers
- support guidance
- training assistance
- onboarding and customer-success support

### Agentic AI

- multi-step reasoning under policy
- tool-mediated workflows
- bounded automation with auditable execution

## Cross-Cutting Controls

- authorization-aware context access
- role-appropriate prompt and agent selection
- model/provider allowlists
- output and tool-use logging
- budget and rate controls
- fallback and failure handling

## Implementation Guidance

When implementation begins:
- start with a small number of stable AI use cases
- define explicit interfaces between product modules and AI services
- treat prompt and agent versions as release-managed artifacts
- avoid hard-coding retrieval logic into business modules
- require evaluation coverage for any materially changed AI workflow

## Phase 18 Implementation

The AI Gateway foundation is implemented in Phase 18.

- **Single entry point** — every AI call routes through `POST /ai/gateway/execute`. Business logic never calls providers directly and never embeds prompt text.
- **Provider abstraction** — `@crm/ai` defines an `AiProvider` interface and placeholder implementations for OpenAI, Anthropic, Azure OpenAI, and a local model. `createAiProviderRegistry` builds the set from environment configuration.
- **Environment-based configuration** — `AI_DEFAULT_PROVIDER`, `AI_DEFAULT_MODEL`, `AI_RATE_LIMIT_PER_MINUTE`, and per-provider keys/endpoints are read from the API environment; per-tenant overrides live in `ai_settings`.
- **Prompt registry** — `defaultAiPromptTemplates` in `@crm/types` is the managed prompt source; callers pass a `templateKey` plus variables.
- **Tenant-aware** — settings and usage logs are keyed by tenant; the gateway resolves the tenant's settings on every call.
- **Permissioned** — gateway execution requires `ai.use_ai` (or higher); settings require `ai.configure`/`ai.manage_ai`; logs require view/dashboard/manage permissions.
- **Logged** — every request is written to `ai_usage_logs` (provider, model, template, status, tokens, latency, errors) and to the audit log.
- **Deferred execution** — providers return governed placeholder responses (status `placeholder`) until credentials and a later execution phase are enabled. A rate-limit placeholder is reported but not enforced.
