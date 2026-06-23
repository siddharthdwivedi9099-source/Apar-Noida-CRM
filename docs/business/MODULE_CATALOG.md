# Module Catalog

## Purpose

This catalog records the major platform and business modules in the product and highlights which ones are now implemented versus still planned.

> **Status reconciliation (2026-06-24 documentation audit):** the modules previously grouped under "Planned Revenue and Service Modules" are now **implemented** (Opportunities, Business Development, Presales, Partner/Reseller, Support, Customer Success). The authoritative, complete list of all 26 implemented API modules is the table at the end of this document. See [../DOCUMENTATION_AUDIT_REPORT.md](../DOCUMENTATION_AUDIT_REPORT.md).

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

### Campaigns

- Status: implemented in Phase 8
- Purpose: configurable campaign planning, execution tracking, audience membership, and marketing foundation workflows
- Primary users: marketing executives, marketing managers, social media marketing roles, campaign owners
- Implemented capabilities:
  - list, detail, create, edit, soft delete
  - owner assignment
  - campaign type, objective, status, and channel tracking
  - target audience and budget fields
  - related asset references
  - campaign member management for leads, contacts, and accounts
  - campaign tasks through the shared productivity model
  - performance dashboard placeholder
  - campaign calendar placeholder
  - permission-aware AI placeholder actions
- Shared dependencies: RBAC, tenant option sets, audit logging, leads, accounts, contacts, and shared productivity routes

### Social Media Marketing

- Status: implemented in Phase 9
- Purpose: social post planning, approvals, calendar visibility, and campaign-linked channel execution
- Primary users: social media marketing executives, marketing managers, campaign owners, approvers
- Implemented capabilities:
  - social media dashboard
  - content calendar
  - social post list, detail, create, edit, and soft delete
  - multi-channel selection
  - campaign linkage
  - post status and approval status tracking
  - owner assignment
  - caption, creative brief, scheduled time, and hashtags
  - engagement, lead capture, listening, and competitor placeholders
  - permission-aware AI placeholder actions
- Shared dependencies: RBAC, tenant option sets, audit logging, campaigns, tenant terminology, and the AI permission model

## Revenue and Service Modules (Implemented)

> These modules were planned in earlier phases and are now implemented with live API routers. The per-module "Status" lines below are retained for history; treat the implemented-modules table at the end of this document as authoritative.

### Opportunities

- Status: implemented in Phase 10
- Purpose: revenue pipeline progression, relationship tracking, and sales forecasting foundations
- Primary users: sales executives, sales managers, sales heads, presales, partner managers, reseller managers
- Implemented capabilities:
  - list, detail, create, edit, soft delete
  - account and primary-contact linkage
  - owner assignment
  - configurable pipeline stages
  - amount, probability, expected close, source, competitor, and next-step tracking
  - stakeholder management
  - win/loss status and reason capture
  - Kanban stage movement with audit logging
  - dashboard metrics for pipeline value, distribution, closing this month, and stalled deals
  - shared notes, activities, tasks, timeline, and permission-aware AI placeholders
- Shared dependencies: RBAC, tenant option sets, audit logging, accounts, contacts, dashboards, and shared productivity routes

### Business Development

- Status: implemented in Phase 12
- Purpose: strategic account targeting, relationship mapping, executive engagement, and BD pipeline development
- Primary users: business development executives and managers
- Implemented capabilities:
  - strategic/target account list, detail, create, edit, soft delete
  - target account profile (tier, industry, region, revenue, employee count, executive sponsor)
  - configurable BD pipeline stage and account tier
  - relationship mapping with influence level, relationship strength, and executive flags
  - market opportunity notes and partnership opportunity tracking
  - territory mapping placeholder
  - permission-aware AI placeholders (account research brief, stakeholder map)
- Shared dependencies: RBAC, tenant option sets, audit logging, accounts, contacts, dashboards

### Presales

- Status: implemented in Phase 12
- Purpose: presales request intake, RFP/RFI tracking, technical requirement mapping, and proposal collaboration
- Primary users: presales executives and managers
- Implemented capabilities:
  - presales request intake, detail, create, edit, soft delete
  - link request to opportunity and account
  - demo, RFP, RFI, proposal, technical-validation, and PoC request types
  - status, priority, due date, and presales task assignment
  - RFP/RFI requirement tracker with compliance matrix status
  - proposal workspace content capture
  - demo calendar and solution repository placeholders
  - permission-aware AI placeholders (RFP extraction, compliance matrix, demo script, proposal response draft, technical risk detection)
- Shared dependencies: RBAC, tenant option sets, audit logging, opportunities, accounts, dashboards

### Partner Channel Management

- Status: implemented in Phase 13
- Purpose: channel partner profiles, onboarding, deal registration, and channel performance tracking
- Primary users: partner managers, reseller managers, business development
- Implemented capabilities:
  - partner list, detail, create, edit, soft delete
  - partner profile (type, tier, status, region, territory, owner, agreement details)
  - partner contacts management
  - partner onboarding status and onboarding checklist
  - partner deal registration with opportunity, account, and lead linkage
  - partner performance dashboard (active partners, registered/won deals, tier distribution)
  - enablement assets, training linkage, and support tickets placeholders
  - permission-aware AI placeholders (fit score, performance summary, action plan, churn risk, conflict detection)
- Shared dependencies: RBAC, tenant option sets, audit logging, accounts, contacts, opportunities, leads, dashboards

### Support Ticketing

- Status: implemented in Phase 15
- Purpose: ticket queues, SLA tracking, escalation, conversation, and knowledge base for service operations
- Primary users: support executives and managers
- Implemented capabilities:
  - ticket list, detail, create, edit, assign, soft delete
  - ticket status, priority, category, and source classification
  - SLA policy configuration with first-response and resolution due-date calculation and breach status
  - escalation status, root cause, and resolution notes
  - internal notes and customer-visible replies
  - related account, contact, and customer success account links
  - knowledge base articles with categories and ticket linkage
  - support dashboard (open, unassigned, escalated, SLA-breached, distributions)
  - attachments, CSAT, and escalation workflow placeholders
  - permission-aware AI placeholders (classification, suggested response, similar tickets, knowledge recommendation, summary, escalation recommendation)
- Shared dependencies: RBAC, tenant option sets, audit logging, accounts, contacts, dashboards

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
- Support, onboarding, and customer-success modules should extend these entities rather than duplicate them.
- Tenant option sets and terminology must remain the source of truth for configurable dropdowns and labels.
- Every new module should inherit the existing RBAC, audit, and soft-delete patterns.

## All Implemented Modules (2026-06-24 audit — authoritative)

All 26 modules below ship with live API routers (`apps/api/src/modules/`). Route prefixes are mounted in `apps/api/src/routes/v1.router.ts`.

| Module | Route prefix | Area |
|--------|--------------|------|
| auth | `/auth` | Identity & access |
| rbac | `/rbac` | Identity & access |
| tenant-config | `/tenant-config` | Configuration |
| crm | `/records`, `/leads`, `/accounts`, `/contacts` | Core CRM |
| opportunities | `/opportunities` | Revenue |
| campaigns | `/campaigns` | Marketing |
| social | `/social` | Marketing |
| sales-workspaces | `/sales-workspaces` | SDR / inside sales |
| business-development | `/business-development` | Revenue |
| presales | `/presales` | Revenue |
| partners | `/partners` | Ecosystem |
| resellers | `/resellers` | Ecosystem |
| support | `/support` | Service |
| customer-success | `/customer-success` | Service |
| training | `/training` | Service |
| customer-portal | `/customer-portal` | Customer-facing |
| customer-query | `/customer-query` | Customer-facing AI |
| ai (gateway) | `/ai` | AI platform |
| ai (registry) | `/ai` | AI platform |
| ai-actions | `/ai` | AI platform |
| rag | `/ai` | AI platform |
| dashboards | `/dashboards` | Analytics |
| notifications | `/notifications` | Platform |
| approvals | `/approvals` | Platform |
| workflows | `/workflows` | Automation |
| audit | `/audit` | Compliance |
| observability | `/observability` | Operations |
| health | `/health`, `/` | Operations |

See [../DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md) for cross-references to each module's documentation.
