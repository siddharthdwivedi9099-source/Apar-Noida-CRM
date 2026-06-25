# Apar Noida CRM — Claude Code Instructions

This project is a production-grade AI-native CRM, not an MVP.

## Core Rule
Use the CRM configuration engine wherever possible. Do not hard-code CRM stages, fields, workflows, approvals, dashboards, roles, validations, notifications, or AI governance rules unless the configuration engine does not yet support that capability.

## Product Goal
Build a configurable CRM supporting:
- Marketing
- Campaign management
- Lead management
- Account and contact management
- Opportunity pipeline
- Proposal, quote, contract, and approvals
- Partner and reseller management
- Support ticketing
- Customer success
- Renewal and expansion
- AI assistant
- AI governance
- Dashboards and analytics
- Admin configuration

## Non-Negotiable Rules
- Do not delete existing work.
- Do not rewrite the app from scratch.
- Do not break completed phases.
- Implement one phase at a time.
- Inspect the repo before coding.
- Produce a plan before implementation.
- Use existing coding patterns.
- Add tests where relevant.
- Run test/build/lint after changes.
- Report changed files, completed work, failed tests, and remaining gaps.
- Sensitive AI actions must require human review.
- AI outputs must include confidence, explanation, and audit logging where applicable.
- Future CRM changes should be possible from configuration, not code.

## Development Flow
For every phase:
1. Read this CLAUDE.md file.
2. Inspect current code.
3. Identify impacted files.
4. Explain the implementation plan.
5. Implement only the requested phase.
6. Run tests/build/lint.
7. Summarize changed files and gaps.
