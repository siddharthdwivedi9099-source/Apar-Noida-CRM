# Release Notes

## Purpose

Release notes provide a human-readable summary of what a release means to stakeholders. Unlike the changelog, which is optimized for cumulative historical tracking, release notes are optimized for communicating release intent, scope, and impact.

## Scope

Release notes should summarize:
- the theme of a release
- what was included
- what was intentionally excluded
- why the release matters
- what is recommended next

## Current Implemented Repository State

The repository is currently beyond the original `v0.1.0` baseline.

As of **June 15, 2026**, the implemented state includes:
- Phase 0 repository and documentation foundation
- Phase 1 frontend and backend project initialization

This implemented state is reflected in the repository and changelog, even though the latest formal release baseline documented here remains `v0.1.0`.

## Phase 1 Implemented State Summary

### Theme

Backend and frontend project initialization on top of the original documentation baseline.

### Included in the Current Implemented State

- React + TypeScript + Vite frontend in `apps/web`
- Tailwind CSS and ShadCN-ready structure
- responsive shell with sidebar and topbar
- placeholder routes for login, dashboard, admin, leads, accounts, opportunities, campaigns, support, customer success, and AI assistant
- Express + TypeScript API in `apps/api`
- versioned API structure under `/api/v1`
- working health endpoint at `/api/v1/health`
- centralized API error handling and request logging foundation
- initialized shared packages for config, types, UI, auth, AI, and database placeholders
- DevOps and local run documentation

### Explicitly Not Included Yet

- authentication
- RBAC enforcement
- tenant-context propagation
- CRM business logic
- persistence logic
- workflow execution
- AI runtime execution

### Why This Matters

This means the platform is no longer only a documentation baseline. It now has a real application frame that can support the next implementation phase safely and consistently.

### Recommended Next Phase

The next implementation phase should focus on:
- Authentication
- RBAC
- tenant context propagation

These should be treated as the next core platform features before deeper CRM module implementation begins.

## Latest Formal Release Baseline: v0.1.0

Release date: **June 14, 2026**

### Release Theme

Foundation and documentation baseline for the AI-native CRM platform.

### Summary

`v0.1.0` established the starting point for the platform as a documentation-first program. It defined the product shape, architecture direction, security posture, AI governance baseline, customer-success scope, and release framework needed before implementation began.

### Included in v0.1.0

- Repository directory structure for future applications and packages
- Product vision, business requirements, and functional baseline documentation
- Architecture, data-model, and multi-tenancy direction
- Security design and first-pass role access baseline
- AI Gateway, Prompt Registry, Agent Registry, RAG, and customer query design baseline
- Customer success, training, and health model documentation
- Testing and deployment guidance
- Local development environment template and dependency scaffold

### Not Included in v0.1.0

- runnable application logic
- APIs
- authentication and authorization implementation
- CRM module implementation
- workflow engine logic
- database schemas and migrations
- AI runtime or provider integration
