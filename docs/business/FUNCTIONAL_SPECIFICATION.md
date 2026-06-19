# Functional Specification

## Purpose

This document summarizes the platform behavior now implemented through Phase 11.

## Functional Principles

- every function runs inside tenant context
- every business module inherits RBAC and audit logging
- tenant configuration should feed CRM behavior instead of hardcoded UI vocabulary
- core CRM records should be soft-delete-safe and extensible from the beginning
- shared touchpoint tracking should be reusable across future modules instead of rebuilt per module

## Implemented Platform Functions

### Authentication and Session Control

Implemented:
- tenant-aware login
- logout
- refresh token rotation
- current-user loading
- protected frontend routes
- login audit logging
- failed-login handling and rate limiting

### Role and Permission Management

Implemented:
- permission catalog
- role templates
- role CRUD
- permission assignment to roles
- role assignment to users
- permission-aware navigation
- permission middleware in the API

### Tenant and Configuration Engine

Implemented:
- tenant workspace settings
- tenant theme settings
- module enable and disable settings
- terminology configuration
- configurable option-set foundation
- configurable pipeline, ticket-status, and customer-success-stage catalogs
- custom field metadata foundation
- custom form layout foundation

### Audit and Traceability

Implemented:
- auth audit events
- RBAC audit events
- tenant configuration audit events
- CRM create, update, delete, note, activity, and task audit events
- campaign and social marketing create, update, and delete audit events
- opportunity create, update, delete, and stage-change audit events
- SDR and inside-sales workflow, handoff, and task-linked queue audit events

## Implemented CRM Functions

### Lead Module

Implemented:
- lead list
- lead detail
- create lead
- edit lead
- soft delete lead
- assign owner
- lead status
- lead source
- lead score placeholder
- lead notes
- lead activities
- lead tasks
- lead timeline
- conversion placeholder

### Account Module

Implemented:
- account list
- account detail
- create account
- edit account
- soft delete account
- owner assignment
- account type
- industry
- website
- account health placeholder
- related contacts
- related opportunities placeholder
- notes
- activities
- tasks
- timeline

### Contact Module

Implemented:
- contact list
- contact detail
- create contact
- edit contact
- soft delete contact
- owner assignment
- contact role
- account relationship
- email
- phone
- LinkedIn
- notes
- activities
- tasks
- timeline

### Campaign Module

Implemented:
- campaign list
- campaign detail
- create campaign
- edit campaign
- soft delete campaign
- campaign type
- campaign objective
- campaign target audience
- campaign budget
- campaign owner
- campaign status
- campaign channel
- campaign start and end dates
- campaign member management for leads, contacts, and accounts
- campaign performance placeholder
- campaign calendar placeholder
- AI campaign placeholders

### Opportunity Module

Implemented:
- opportunity list
- opportunity detail
- create opportunity
- edit opportunity
- soft delete opportunity
- account linkage
- primary contact linkage
- owner assignment
- configurable stage
- amount
- probability
- expected close date
- source
- competitor tracking
- stakeholder tracking
- next step
- win and loss status
- win and loss reason
- products and services placeholder
- AI opportunity placeholders
- notes
- activities
- tasks
- timeline

### Sales Pipeline and Dashboarding

Implemented:
- configurable opportunity pipeline stages
- Kanban pipeline view
- drag-and-drop stage updates
- stage-change audit logging
- stage-change timeline activity creation
- pipeline filters
- my pipeline scope
- team pipeline scope based on permission
- tenant-wide pipeline scope based on permission
- pipeline value metric
- stage distribution metric
- closing this month metric
- stalled deals metric
- forecast placeholder
- deal risk placeholder

### SDR and Inside Sales Workspace

Implemented:
- SDR prospecting queue
- SDR assigned-lead queue
- SDR call task list
- outreach status tracking
- qualification checklist using BANT
- MEDDIC placeholder
- custom qualification fields stored in lead metadata
- qualification notes
- lead handoff status tracking
- inside-sales lead queue
- inside-sales call queue
- inside-sales follow-up task queue
- lead status updates from the workspace
- call disposition tracking
- conversion handoff to sales
- productivity dashboard metrics
- AI workspace placeholders for:
  - call script generation
  - objection handling
  - lead research summary
  - follow-up email generation
  - qualification score

### Social Media Marketing Module

Implemented:
- social media dashboard
- content calendar
- social post list
- create social post
- edit social post
- soft delete social post
- channel selection
- campaign mapping
- post status
- approval status
- content owner
- scheduled date and time
- caption
- creative brief
- hashtags
- engagement placeholder
- social lead capture placeholder
- social listening placeholder
- competitor tracking placeholder
- AI caption placeholder
- AI hashtag placeholder
- AI creative brief placeholder
- AI engagement summary placeholder
- AI lead intent placeholder

## Shared Productivity and Touchpoint Tracking

Implemented:
- activity creation
- activity types:
  - call
  - email
  - meeting
  - chat
  - social
  - demo
  - training
  - support
  - renewal
- activity owner
- activity date and time
- activity outcome
- activity notes
- task creation
- task assignment
- due date
- priority
- status
- related record linkage
- reminder placeholder
- internal notes
- customer-facing notes flag
- unified customer timeline
- timeline filters by touchpoint type
- chronological timeline ordering

Foundation-only shared record support is still prepared for:
- tickets
- customer-success accounts

## Cross-Cutting CRM Behavior

Implemented:
- pagination
- search
- filters
- sorting
- validation
- tenant isolation
- RBAC-backed route and action gating
- assigned-lead visibility enforcement inside SDR and inside-sales queues for non-manager roles
- soft delete
- audit logging on write operations
- loading states
- empty states

## Frontend Functional Behavior

Implemented:
- list pages for leads, accounts, and contacts
- detail pages for leads, accounts, and contacts
- create and edit forms for leads, accounts, and contacts
- campaign list, detail, create, and edit flows
- social dashboard, calendar, list, detail, create, and edit flows
- notes panel on detail pages
- activity panel on detail pages
- task list on detail pages
- filterable timeline component on detail pages
- role-aware action buttons
- protected routes for list, detail, create, and edit flows
- sales dashboard cards and Kanban stage movement for opportunities

Current UX behavior:
- unauthorized users do not see modules in navigation
- disabled tenant modules are blocked at the route layer
- form dropdowns use tenant-configured option sets
- notes, activities, tasks, and the timeline are managed directly from detail pages
- campaign and social forms use tenant-configured marketing vocabularies
- social approval and channel choices are enforced through role-aware routes and APIs

## Business Development and Presales (Phase 12)

Business Development functions:
- maintain a strategic/target account list with tier and BD pipeline stage
- capture target account profile (industry, region, revenue, employees, executive sponsor)
- map relationships and executive engagement with influence level and relationship strength
- record market opportunity notes and track partnership opportunities
- territory mapping is exposed as a placeholder for a later phase

Presales functions:
- intake presales requests for demos, RFP, RFI, proposals, technical validation, and PoCs
- link a request to an opportunity and account
- assign presales owners and assignees with priority and due dates
- track RFP/RFI requirements with a compliance matrix (met, partial, gap, not applicable)
- maintain proposal workspace content per request
- demo calendar and solution repository are exposed as placeholders for a later phase

Phase 12 UX behavior:
- BD and presales modules respect tenant module switches and role permissions
- BD pipeline stage, account tier, partnership type, presales request type, and status use tenant-configured option sets
- AI placeholders are permission-aware and remain deferred until the AI Gateway phase

## Functions Still Pending

Still out of scope:
- public registration
- admin-created user lifecycle UI
- dedicated opportunity management
- lead conversion workflow
- dedicated ticket and customer-success operational modules
- dynamic custom-field rendering in live CRM forms
- record-level authorization beyond tenant boundaries

## Dashboards and Analytics (Phase 23)

The platform provides eighteen role-based dashboards: executive, sales, marketing, campaign, social media, SDR, inside sales, presales, partner, reseller, support, customer success, onboarding, customer health, training, revenue, forecast, and AI insights.

- **Role-based visibility** — each dashboard declares the permissions allowed to view it; the catalog returns a `permitted` flag per dashboard, and opening a dashboard the user can't access is rejected.
- **Configurable widgets** — dashboards compose widgets of several kinds: metric scalars, charts (breakdowns), funnels (pipeline stages), series (timelines), tables, and kanban summaries (status columns for tickets and leads).
- **Real CRM data** — widgets compute from live tables: leads by status/source, opportunities by stage, pipeline and forecast value, win rate, campaigns and members, open tickets and SLA breaches, ticket priority/category, customer health distribution, at-risk customers, adoption score, training completion, renewal timeline, and onboarding progress. AI-insight widgets derive risk alerts, recommended actions, underperforming areas, and customer/deal risk. Campaign conversion and CSAT are explicit deferred placeholders.
- **Date filters** — dashboards accept `from`/`to` date filters applied to the underlying records where applicable.
- **Drill-down** — drill-down-enabled widgets return the underlying records (leads, opportunities, tickets, at-risk customers, deals at risk).
- **Saved views** — users save and reuse dashboard views (date ranges and configuration), optionally shared with the tenant.
- **Export** — dashboards can be exported subject to an export permission check; exports are audited.

The customer success and AI insights dashboards are first-class members of this set.
