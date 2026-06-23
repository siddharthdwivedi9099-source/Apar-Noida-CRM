# RAG Architecture

## Purpose

This document defines the retrieval-augmented generation architecture for the platform and explains how knowledge-backed AI responses should be grounded, authorized, and observable.

## Scope

This document covers:
- knowledge source types
- ingestion and retrieval stages
- access-control requirements
- freshness and provenance expectations
- implementation guidance

This document does not cover:
- vector database vendor selection
- embedding model specifics
- final ranking algorithms

## Objectives

- improve factual grounding of AI responses
- support knowledge-backed assistance for internal and future customer-facing use cases
- enforce tenant and role boundaries during retrieval
- make source provenance and freshness reviewable

## Knowledge Source Categories

- product documentation
- support articles and runbooks
- onboarding material
- training material
- approved internal playbooks
- account- or case-specific context where policy permits

## Ingestion Pipeline

### Source Registration

Approved sources should be registered with ownership, access classification, and freshness metadata.

### Normalization

Content should be transformed into a canonical representation suitable for downstream processing.

### Chunking

Documents should be segmented into retrieval-appropriate units while preserving provenance.

### Embedding and Indexing

Chunks should be embedded and stored with enough metadata to support tenant-aware and role-aware retrieval.

## Retrieval Pipeline

1. receive a query with tenant and actor context
2. apply access and scope constraints
3. retrieve relevant content candidates
4. rank or filter candidates
5. assemble context with provenance
6. pass context into the AI execution path

## Access-Control Requirements

- knowledge documents must carry tenant and sensitivity metadata
- retrieval must enforce actor and role boundaries
- shared global content must be explicitly marked and governed
- customer-specific content must not leak across accounts or tenants

## Freshness and Quality Expectations

- track source freshness and ingestion time
- support re-indexing for updated knowledge
- allow curated high-trust content sets for sensitive use cases
- monitor stale, low-value, or duplicate content patterns

## Provenance Requirements

The platform should preserve:
- source document identity
- chunk lineage
- retrieval time metadata
- resolved prompt and AI request references where needed

## Implementation Guidance

When implementation begins:
- start with a small, approved source set
- define metadata standards before large-scale ingestion
- integrate authorization into retrieval, not only at final response time
- keep ingestion and retrieval contracts observable and testable
- avoid using RAG as a substitute for authoritative system-of-record data

## Phase 20 Implementation

The RAG foundation is implemented as of Phase 20: permission-aware, tenant-aware ingestion and retrieval with deferred embeddings.

### Data model

- **`knowledge_sources`** — tenant-scoped corpus categories (`product_documentation`, `user_guide`, `admin_guide`, `training_content`, `faq`, `release_notes`, `support_article`, `resolved_ticket`, `customer_document`). Each source has an `access_scope` (`tenant`/`restricted`) and an optional `required_permission` that gates retrieval. Nine baseline sources are seeded per tenant on first read.
- **`knowledge_documents`** — ingested text (title, summary, content, format, source URI, status `pending`/`chunked`/`embedded`, chunk/token counts).
- **`knowledge_chunks`** — chunked content with `embedding_status` (`pending`/`placeholder`/`embedded`), `embedding_model`, and an `embedding_ref` (vector-storage reference placeholder).
- **`knowledge_articles`** + **`knowledge_article_versions`** — versioned, approval-gated knowledge articles (`draft`/`pending_review`/`approved`/`archived`, `is_published`).
- **`knowledge_gaps`** — tracked queries that returned no results (placeholder for gap analysis).

### Ingestion pipeline

1. **Text ingestion** — a document is created under a source (`POST /ai/knowledge/sources/:sourceId/documents`).
2. **Chunking** — content is split into overlapping, boundary-aware chunks immediately; the document moves to `chunked`.
3. **Embedding (placeholder)** — `POST /ai/knowledge/documents/:documentId/process` marks chunks as `placeholder`-embedded, records the embedding model, and writes a vector reference per chunk; the document moves to `embedded`. Live embeddings through the AI Gateway and a real vector store are deferred.

### Retrieval

`POST /ai/rag/retrieve` returns ranked citations for a query:

- **Tenant-aware** — only the current tenant's corpus is searched.
- **Permission-aware** — only enabled sources with no `required_permission`, or those the actor holds the permission for, contribute. Restricted sources the actor can't access are excluded and counted (`restrictedSourceCount`).
- **Citations** — every result carries its source (id, name, type) plus the document/chunk or article it came from, a snippet, and a score.
- **Approved knowledge only** — articles must be `approved` and `published` to appear.
- **Gap logging** — a query with no results is recorded in `knowledge_gaps`.

Retrieval is keyword/overlap-based (`strategy = keyword_placeholder`) until vector embeddings are enabled; the response advertises the configured `vectorBackend` and `embeddingModel` and flags `deferred: true`.

## Governance Review Confirmation (2026-06-24)

The AI governance review verified retrieval grounding in code:
- **Permission-filtered grounding.** Retrieval runs as the calling actor; knowledge sources carrying a `required_permission` are excluded unless the actor holds it, so citations never expose content the caller may not see. `accessibleSourceCount`/`restrictedSourceCount` are reported.
- **Approved-only.** Only `approved` + `published` articles from enabled, tenant-scoped sources are returned.
- **Citations & grounding signal.** Every result carries source id/name/type, snippet, and score; downstream answers set an `is_grounded` flag and escalate rather than fabricate when retrieval is empty.
- **Knowledge gaps.** Empty retrievals are logged to `knowledge_gaps` for review.

See [AI_GOVERNANCE_REVIEW_REPORT.md](./AI_GOVERNANCE_REVIEW_REPORT.md) for the full assessment.

See [../technical/API_DOCUMENTATION.md](../technical/API_DOCUMENTATION.md) for the full route list and [../technical/DATA_MODEL.md](../technical/DATA_MODEL.md) for the schema.
