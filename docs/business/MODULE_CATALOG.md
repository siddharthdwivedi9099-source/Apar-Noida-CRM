# Module Catalog

## Purpose

This catalog records the major platform and business modules in the product and highlights which ones are now implemented versus still planned.

## Implemented Platform Modules

### Tenant Administration

- Status: implemented
- Purpose: tenant setup, theme, terminology, module switches, and metadata configuration
- Primary users: tenant admins
- Key dependencies: authentication, RBAC, audit logging

### Identity and Access

- Status: implemented
- Purpose: users, roles, permissions, sessions, protected routes, and permission enforcement
- Primary users: tenant admins, platform admins
- Key dependencies: database, audit logging

### Audit and Compliance

- Status: implemented
- Purpose: capture security-sensitive and administrative actions
- Primary users: admins, auditors, security reviewers
- Key dependencies: every write-capable module

### Configuration Management

- Status: implemented
- Purpose: tenant settings, option sets, custom-field metadata, and form-layout metadata
- Primary users: tenant admins
- Key dependencies: tenant administration, audit logging

## Implemented Core CRM Modules

### Leads

- Status: implemented in Phase 6
- Purpose: intake, qualification, source tracking, owner assignment, notes, and activities
- Primary users: SDRs, inside sales, marketing-to-sales handoff roles
- Implemented capabilities:
  - list, detail, create, edit, soft delete
  - owner assignment
  - status and source tracking
  - lead score placeholder
  - notes and activities
  - conversion placeholder
- Shared dependencies: RBAC, tenant option sets, audit logging, tenant terminology

### Accounts

- Status: implemented in Phase 6
- Purpose: shared customer or company record for downstream modules
- Primary users: sales, support, customer success, managers
- Implemented capabilities:
  - list, detail, create, edit, soft delete
  - owner assignment
  - account type and industry fields
  - website
  - account health placeholder
  - related contacts
  - related opportunities placeholder
  - notes and activities
- Shared dependencies: RBAC, tenant option sets, audit logging, account-contact relationship model

### Contacts

- Status: implemented in Phase 6
- Purpose: stakeholder identity, relationship mapping, and account linkage
- Primary users: sales, support, customer success, partner-facing roles
- Implemented capabilities:
  - list, detail, create, edit, soft delete
  - owner assignment
  - account relationship
  - contact role
  - email, phone, LinkedIn
  - notes and activities
- Shared dependencies: RBAC, tenant option sets, audit logging, account relationship model

## Planned Revenue and Service Modules

### Opportunities

- Status: planned
- Purpose: revenue pipeline progression and forecasting
- Expected dependencies: accounts, contacts, leads, workflows, dashboards

### Campaigns

- Status: planned
- Purpose: campaign execution and downstream attribution
- Expected dependencies: leads, dashboards, marketing

### Support

- Status: planned
- Purpose: issue intake, triage, and resolution
- Expected dependencies: accounts, contacts, option sets, audit logging

### Customer Success

- Status: planned
- Purpose: onboarding, health, retention, and renewal coordination
- Expected dependencies: accounts, contacts, support, configuration engine

### Partner and Reseller Modules

- Status: planned
- Purpose: ecosystem relationship management
- Expected dependencies: accounts, contacts, opportunities, onboarding, dashboards

## AI and Workflow Modules

### AI Assistant

- Status: shell and permission gating implemented
- Purpose: governed AI entry point for later prompts, agents, and retrieval workflows
- Current state: navigation, route protection, and permission vocabulary exist

### Workflows

- Status: planned
- Purpose: automate cross-module transitions and approvals
- Expected dependencies: CRM entities, RBAC, audit logs, configuration metadata

## Dependency Guidance

- Leads, accounts, and contacts are now the shared CRM kernel.
- Future opportunities, support, onboarding, and customer-success modules should extend these entities rather than duplicate them.
- Tenant option sets and terminology must remain the source of truth for configurable dropdowns and labels.
- Every new module should inherit the existing RBAC, audit, and soft-delete patterns.
