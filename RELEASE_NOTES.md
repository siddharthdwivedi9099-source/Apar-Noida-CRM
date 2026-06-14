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

## v0.1.0

Release date: **2026-06-14**

### Release Theme

Foundation and documentation baseline for the AI-native CRM platform.

### Summary

`v0.1.0` establishes the starting point for the platform as a documentation-first program. It defines the product shape, architecture direction, security posture, AI governance baseline, customer-success scope, and release framework needed before implementation begins.

### Included in This Release

- Repository directory structure for future applications and packages
- Product vision, business requirements, and functional baseline documentation
- Architecture, data-model, and multi-tenancy direction
- Security design and first-pass role access baseline
- AI Gateway, Prompt Registry, Agent Registry, RAG, and customer query design baseline
- Customer success, training, and health model documentation
- Testing and deployment guidance
- Local development environment template and dependency scaffold

### Why This Release Matters

This release creates alignment before code is written. It reduces implementation risk by documenting:
- what the product is meant to solve
- which modules exist and why
- how tenancy and security should shape the platform
- how AI capabilities must be governed
- how future phases should be sequenced

### Not Included in This Release

- Application logic
- APIs
- authentication and authorization implementation
- CRM module implementation
- workflow engine logic
- database schemas and migrations
- AI runtime or provider integration

### Intended Audience

- Product and business stakeholders validating scope
- Architecture and engineering leads defining implementation direction
- Future contributors who need a documented baseline before coding

### Recommended Follow-Up

The next release should focus on platform foundation work: monorepo wiring, shared configuration and type contracts, CI quality gates, observability scaffolding, and tenant-aware engineering conventions.
