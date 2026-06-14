# RBAC Matrix

## Purpose

This document provides the baseline role-to-capability mapping for the platform. It acts as a planning artifact for future authorization design and should be read together with the business-facing [ROLE_CATALOG.md](../business/ROLE_CATALOG.md).

## Scope

This document covers:
- baseline role groups
- capability domains
- initial access expectations
- guidance for future implementation

This document does not cover:
- record-level policies
- field-level redaction logic
- dynamic approval workflows

## Access Legend

- `M`: manage
- `E`: edit or execute
- `V`: view
- `-`: no baseline access

## Authorization Principles

- access should be tenant-scoped unless explicitly platform-level
- roles should grant responsibility-aligned access rather than broad convenience access
- platform and tenant administration must remain separated
- AI governance capabilities should be limited to specialized roles

## Baseline Capability Matrix

| Capability | Platform Admin | Tenant Admin | Security Reviewer | Marketing Manager | SDR | Account Executive | Presales Engineer | Partner Manager | Support Agent | Customer Success Manager | Onboarding Specialist | Training Specialist | AI Admin | Executive Viewer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tenant settings | M | M | V | - | - | - | - | - | - | - | - | - | - | V |
| User and team management | M | M | V | - | - | - | - | - | - | - | - | - | - | - |
| Role assignment | M | M | V | - | - | - | - | - | - | - | - | - | - | - |
| Audit log review | M | V | M | - | - | - | - | - | - | - | - | - | V | V |
| Campaign management | V | V | - | M | E | V | - | - | - | - | - | - | - | V |
| Lead management | V | V | - | E | M | E | - | - | - | - | - | - | - | V |
| Opportunity management | V | V | - | V | E | M | E | - | - | - | - | - | - | V |
| Partner and reseller records | V | V | - | - | - | V | V | M | - | - | - | - | - | V |
| Support tickets | V | V | - | - | - | V | - | - | M | V | - | - | - | V |
| Success plans and health | V | V | - | - | - | V | - | - | V | M | E | V | - | V |
| Onboarding plans | V | V | - | - | - | V | V | - | - | E | M | V | - | V |
| Training content and sessions | V | V | - | - | - | - | V | - | - | E | E | M | - | V |
| Knowledge source curation | V | V | - | - | - | - | V | - | V | E | E | E | M | V |
| Prompt registry | V | V | V | - | - | - | - | - | - | - | - | - | M | V |
| Agent registry | V | V | V | - | - | - | - | - | - | - | - | - | M | V |
| AI query policy management | V | V | V | - | - | - | - | - | - | - | - | - | M | V |
| Executive dashboards | V | V | V | V | V | V | V | V | V | V | V | V | V | M |

## Capability Domains

### Platform Administration

- tenant settings
- user and team management
- role assignment
- audit visibility

### Revenue Operations

- campaign management
- lead management
- opportunity management
- partner contribution visibility where relevant

### Service and Success

- support ticketing
- onboarding plans
- training visibility
- success plans and health

### AI Governance

- knowledge source curation
- prompt registry
- agent registry
- AI query policy management

## Implementation Guidance

When authorization is implemented:
- translate matrix rows into stable permission families
- avoid hard-coding roles directly into business logic
- support inheritance and composition where roles overlap
- add record- and field-level controls only after baseline role permissions are clear
- ensure every privileged action is auditable

## Review Guidance

This matrix should be revisited whenever:
- a new module is added
- a new administrative capability is introduced
- AI behavior affects sensitive data or action-taking
- tenant custom role support expands beyond template-based access
