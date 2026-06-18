# API Documentation

## Base URL

Local default:

```text
http://127.0.0.1:4000/api/v1
```

Browser auth uses credentialed refresh-token cookies, so `API_CORS_ORIGIN` must allow the active frontend origin.

## Root and Health

### `GET /`

Returns API phase metadata.

### `GET /health`

Returns service health and dependency status.

## Authentication

### `POST /auth/login`

Authenticates a tenant user, issues a JWT access token, rotates the refresh token session, sets the HTTP-only cookie, applies failed-login controls, and writes audit logs.

Request body:

```json
{
  "tenantSlug": "sample-tenant",
  "email": "admin@sample-tenant.local",
  "password": "ChangeMe123!"
}
```

### `POST /auth/refresh`

Rotates the refresh token and returns a fresh access token.

### `POST /auth/logout`

Revokes the active session and clears the refresh token cookie.

### `GET /auth/me`

Returns the current authenticated user and session summary.

## RBAC and Tenant Configuration

Implemented route groups:
- `/rbac/*`
- `/tenant-config/*`

These remain unchanged from Phases 4 and 5 and continue to require authenticated, permission-aware access.

## SDR and Inside Sales Workspace

### Sales workspace routes

- `GET /sales-workspaces/options`
- `GET /sales-workspaces/sdr`
- `GET /sales-workspaces/inside-sales`
- `PATCH /sales-workspaces/leads/:leadId/workflow`

### Sales workspace options behavior

`GET /sales-workspaces/options` returns:
- `owners`
- `leadStatuses`
- `leadSources`
- `outreachStatuses`
- `handoffStatuses`
- `callDispositions`
- `qualificationFrameworks`

### SDR workspace behavior

`GET /sales-workspaces/sdr` returns:
- `dashboard`
- `assignedLeads`
- `prospectingQueue`
- `callTaskList`
- `aiPlaceholders`

Non-manager roles only receive leads they own. Manager and admin-style roles with assign or configure access can see a broader tenant queue.

### Inside-sales workspace behavior

`GET /sales-workspaces/inside-sales` returns:
- `dashboard`
- `leadQueue`
- `callQueue`
- `followUpTasks`
- `aiPlaceholders`

### Lead workflow update example

`PATCH /sales-workspaces/leads/:leadId/workflow`

```json
{
  "statusKey": "qualified",
  "outreachStatusKey": "responded",
  "handoffStatusKey": "sales_ready",
  "callDispositionKey": "connected",
  "qualificationFramework": "bant",
  "qualificationChecklist": {
    "budget": true,
    "authority": true,
    "need": true,
    "timeline": false
  },
  "qualificationNotes": "Discovery complete and budget validated.",
  "customQualificationFields": [
    {
      "label": "Region",
      "value": "North America"
    }
  ]
}
```

Owner reassignment through this route requires assign or configure permissions. Constrained users attempting to update a lead they do not own receive `404 LEAD_NOT_FOUND`.

## CRM Foundations, Opportunities, Campaigns, and Social Marketing

All CRM routes require:

```text
Authorization: Bearer <access-token>
```

Every CRM route is tenant-scoped, validation-backed, and soft-delete-aware.

### Supported Shared Record Types

Shared productivity routes support:
- `lead`
- `account`
- `contact`
- `campaign`
- `opportunity`
- `ticket`
- `customer_success_account`

Permission checks map to module families:
- `lead` -> `leads.*`
- `account` -> `accounts.*`
- `contact` -> `contacts.*`
- `campaign` -> `campaigns.*`
- `opportunity` -> `opportunities.*`
- `ticket` -> `support.*`
- `customer_success_account` -> `customer_success.*`

## Opportunity CRUD, Dashboarding, and Pipeline Management

### Opportunity routes

- `GET /opportunities/options`
- `GET /opportunities/dashboard`
- `GET /opportunities`
- `POST /opportunities`
- `GET /opportunities/:opportunityId`
- `PATCH /opportunities/:opportunityId`
- `DELETE /opportunities/:opportunityId`

### Opportunity detail payload behavior

`GET /opportunities/:opportunityId` now returns:
- base commercial fields
- account, primary contact, owner, stage, source, and outcome references
- `stakeholders`
- `productsServicesPlaceholder`
- `forecastPlaceholder`
- `dealRiskPlaceholder`
- `aiPlaceholders`
- `notes`
- `activities`
- `tasks`
- `timeline`

### Opportunity dashboard behavior

`GET /opportunities/dashboard` returns:
- `visibleCount`
- `pipelineValue`
- `closingThisMonthCount`
- `closingThisMonthValue`
- `stalledDealsCount`
- `stalledDealsValue`
- `stageDistribution`
- `forecastPlaceholder`
- `dealRiskPlaceholder`

### Opportunity request example

`POST /opportunities`

```json
{
  "name": "North Region Expansion",
  "accountId": "11111111-1111-1111-1111-111111111111",
  "primaryContactId": "22222222-2222-2222-2222-222222222222",
  "ownerId": "33333333-3333-3333-3333-333333333333",
  "stageKey": "proposal",
  "amount": 125000,
  "probability": 60,
  "expectedCloseDate": "2026-07-28",
  "sourceKey": "referral",
  "competitor": "Legacy Vendor Inc",
  "stakeholderContactIds": ["22222222-2222-2222-2222-222222222222"],
  "nextStep": "Review commercial proposal with procurement"
}
```

Stage updates through `PATCH /opportunities/:opportunityId` write both standard CRM audit events and an `opportunity.stage_change` audit log when the pipeline stage changes.

## Campaign CRUD and Member Management

### Campaign routes

- `GET /campaigns/options`
- `GET /campaigns`
- `POST /campaigns`
- `GET /campaigns/:campaignId`
- `PATCH /campaigns/:campaignId`
- `DELETE /campaigns/:campaignId`

### Campaign member routes

- `GET /campaigns/:campaignId/members`
- `POST /campaigns/:campaignId/members`
- `PATCH /campaigns/:campaignId/members/:memberId`
- `DELETE /campaigns/:campaignId/members/:memberId`

### Campaign detail payload behavior

`GET /campaigns/:campaignId` now returns:
- base campaign strategy fields
- owner and configurable option references
- related assets
- `members`
- `performancePlaceholder`
- `calendarPlaceholder`
- `aiPlaceholders`

Campaign notes, activities, tasks, and timeline items are read through the shared productivity routes using `entityType = campaign`.

## Social Media Marketing

### Social routes

- `GET /social/channels`
- `GET /social/options`
- `GET /social`
- `POST /social`
- `GET /social/:postId`
- `PATCH /social/:postId`
- `DELETE /social/:postId`

### Social detail payload behavior

`GET /social/:postId` now returns:
- base social post planning fields
- owner and linked campaign summary
- `channels`
- `engagementPlaceholder`
- `leadCapturePlaceholder`
- `listeningPlaceholder`
- `competitorTrackingPlaceholder`
- `aiPlaceholders`

### Social request example

`POST /social`

```json
{
  "title": "Q3 launch teaser",
  "caption": "Something big is landing this quarter. Stay tuned.",
  "creativeBrief": "Use the orange gradient brand treatment with product silhouette reveal.",
  "hashtags": ["#launch", "#pipeline", "#crm"],
  "scheduledAt": "2026-06-25T09:30:00.000Z",
  "ownerId": "00000000-0000-0000-0000-000000000000",
  "campaignId": "11111111-1111-1111-1111-111111111111",
  "statusKey": "planned",
  "approvalStatusKey": "pending_review",
  "channelKeys": ["linkedin", "instagram"]
}
```

## Lead, Account, and Contact CRUD

### Lead routes

- `GET /leads/options`
- `GET /leads`
- `POST /leads`
- `GET /leads/:leadId`
- `PATCH /leads/:leadId`
- `DELETE /leads/:leadId`

### Account routes

- `GET /accounts/options`
- `GET /accounts`
- `POST /accounts`
- `GET /accounts/:accountId`
- `PATCH /accounts/:accountId`
- `DELETE /accounts/:accountId`

### Contact routes

- `GET /contacts/options`
- `GET /contacts`
- `POST /contacts`
- `GET /contacts/:contactId`
- `PATCH /contacts/:contactId`
- `DELETE /contacts/:contactId`

### Detail payload behavior

`GET /leads/:leadId`, `GET /accounts/:accountId`, and `GET /contacts/:contactId` now return:
- base record fields
- `notes`
- `activities`
- `tasks`
- `timeline`

Accounts also return:
- `relatedContacts`
- `relatedOpportunitiesPlaceholder`

Leads also return:
- `conversionPlaceholder`

## Shared Productivity Routes

### `GET /records/:entityType/:entityId/timeline`

Returns unified timeline items for the record.

Optional query params:
- `kind`

Supported `kind` values:
- `all`
- `note`
- `activity`
- `task`
- `ticket`
- `campaign`
- `training`
- `onboarding_milestone`

Response shape:

```json
{
  "items": [],
  "availableTouchpointTypes": ["note", "activity", "task"],
  "activeTouchpointType": "all"
}
```

### `GET /records/:entityType/:entityId/notes`

Returns notes attached to the record.

### `POST /records/:entityType/:entityId/notes`

Creates a note for the record.

Request body:

```json
{
  "body": "Customer asked for a revised quote before Friday.",
  "isCustomerFacing": false,
  "metadata": {
    "source": "phase7-test"
  }
}
```

### `PATCH /records/:entityType/:entityId/notes/:noteId`

Updates a note body, customer-facing flag, and metadata merge.

### `GET /records/:entityType/:entityId/activities`

Returns activities attached to the record.

### `POST /records/:entityType/:entityId/activities`

Creates an activity linked to the record.

Request body:

```json
{
  "activityType": "meeting",
  "subject": "Qualification review",
  "outcome": "Moved to technical validation",
  "notes": "Security review requested by procurement.",
  "ownerId": "00000000-0000-0000-0000-000000000000",
  "occurredAt": "2026-06-16T11:30:00.000Z",
  "metadata": {
    "channel": "zoom"
  }
}
```

### `GET /records/:entityType/:entityId/tasks`

Returns tasks attached to the record.

### `POST /records/:entityType/:entityId/tasks`

Creates a task linked to the record.

Request body:

```json
{
  "title": "Send revised proposal",
  "description": "Include updated onboarding timeline and support plan.",
  "dueAt": "2026-06-18T09:00:00.000Z",
  "reminderAt": "2026-06-17T09:00:00.000Z",
  "priority": "high",
  "status": "open",
  "ownerId": "00000000-0000-0000-0000-000000000000",
  "assigneeId": "00000000-0000-0000-0000-000000000000",
  "metadata": {
    "source": "phase7-test"
  }
}
```

Phase 11 workspace task creators use the metadata pattern:

```json
{
  "phase11TaskType": "call"
}
```

### `PATCH /records/:entityType/:entityId/tasks/:taskId`

Updates task ownership, assignee, status, priority, due date, reminder, description, title, and metadata merge.

Assign-only users may only update:
- `ownerId`
- `assigneeId`
- `status`

## Campaign Request Examples

### `POST /campaigns`

```json
{
  "name": "Q3 Expansion Campaign",
  "description": "Multi-channel outreach for expansion-ready accounts.",
  "typeKey": "email",
  "objectiveKey": "pipeline_acceleration",
  "targetAudience": "Expansion-ready customer and prospect accounts in North America.",
  "budgetAmount": 15000,
  "ownerId": "00000000-0000-0000-0000-000000000000",
  "statusKey": "planned",
  "startDate": "2026-07-01",
  "endDate": "2026-07-21",
  "channelKey": "multi_channel",
  "relatedAssets": [
    {
      "label": "Campaign brief",
      "url": "https://assets.example.test/q3-expansion-brief",
      "assetType": "brief"
    }
  ],
  "metadata": {
    "source": "phase8-test"
  }
}
```

### `POST /campaigns/:campaignId/members`

```json
{
  "memberEntityType": "lead",
  "memberEntityId": "00000000-0000-0000-0000-000000000000",
  "statusKey": "planned",
  "response": "Queued for first-touch email",
  "metadata": {
    "source": "phase8-test"
  }
}
```

## Compatibility CRM Routes

The original Phase 6 routes remain available for lead, account, and contact note and activity creation:
- `POST /leads/:leadId/notes`
- `POST /leads/:leadId/activities`
- `POST /accounts/:accountId/notes`
- `POST /accounts/:accountId/activities`
- `POST /contacts/:contactId/notes`
- `POST /contacts/:contactId/activities`

These now use the shared productivity service behavior internally.

## Business Development Routes (Phase 12)

All routes require one of the `business_development.*` permissions and are tenant-scoped with owner/team/all visibility.

- `GET /business-development/options` — owners, accounts, contacts, tier/stage/partnership option sets, available scopes
- `GET /business-development` — paginated target accounts; filters: `search`, `tier`, `stage`, `partnershipType`, `ownerId`, `isPartnership`, `scope`, `sortBy`, `sortOrder`
- `POST /business-development` — create a target account (requires `tierKey`, `stageKey`); accepts profile fields and an optional `stakeholders[]` relationship map
- `GET /business-development/:targetAccountId` — target account detail with stakeholders, territory placeholder, and AI placeholders
- `PATCH /business-development/:targetAccountId` — partial update; owner-only mutations allowed for assign permission
- `DELETE /business-development/:targetAccountId` — soft-delete the target account and its stakeholders

## Presales Routes (Phase 12)

All routes require one of the `presales.*` permissions and are tenant-scoped; `mine` scope matches owner or assignee.

- `GET /presales/options` — owners, accounts, opportunities, request-type/status option sets, priorities, available scopes
- `GET /presales` — paginated requests; filters: `search`, `type`, `status`, `priority`, `ownerId`, `assigneeId`, `opportunityId`, `accountId`, `scope`, `sortBy`, `sortOrder`
- `POST /presales` — create a request (requires `title`, `typeKey`); optional `opportunityId` link plus a `requirements[]` RFP/RFI tracker
- `GET /presales/:requestId` — request detail with requirements, proposal content, demo-calendar and solution-repository placeholders, and AI placeholders
- `PATCH /presales/:requestId` — partial update; assignment-only mutations allowed for assign permission
- `DELETE /presales/:requestId` — soft-delete the request and its requirements

## Partner Channel Routes (Phase 13)

All routes require one of the `partners.*` permissions and are tenant-scoped with owner/team/all visibility.

- `GET /partners/options` — owners, accounts, contacts, opportunities, partner type/tier/status/onboarding/deal-stage option sets, available scopes
- `GET /partners/dashboard` — partner counts, active partners, onboarding-in-progress, registered deal count/value, won deals, and tier distribution
- `GET /partners` — paginated partners; filters: `search`, `type`, `tier`, `status`, `onboardingStatus`, `ownerId`, `scope`, `sortBy`, `sortOrder`
- `POST /partners` — create a partner (requires `typeKey`, `tierKey`); accepts profile fields, `contacts[]`, and an `onboardingTasks[]` checklist
- `GET /partners/:partnerId` — partner detail with contacts, onboarding checklist, registered deals, performance summary, and placeholders (enablement assets, training, support tickets)
- `PATCH /partners/:partnerId` — partial update; owner-only mutations allowed for assign permission; syncs contacts and onboarding tasks
- `DELETE /partners/:partnerId` — soft-delete the partner and its child records
- `GET /partners/:partnerId/deals` — registered deals for the partner
- `POST /partners/:partnerId/deals` — register a deal (requires `name`); optional opportunity/account/lead links
- `PATCH /partners/:partnerId/deals/:dealId` — update a registered deal (stage, amount, links)

## Reseller Management Routes (Phase 14)

All routes require one of the `resellers.*` permissions and are tenant-scoped with owner/team/all visibility.

- `GET /resellers/options` — owners, accounts, contacts, opportunities, reseller status/pricing-tier/margin-profile/onboarding/deal-stage option sets, available scopes
- `GET /resellers/dashboard` — reseller counts, active resellers, onboarding-in-progress, registered deal count/value, won deals, average margin, and pricing-tier distribution
- `GET /resellers` — paginated resellers; filters: `search`, `status`, `pricingTier`, `marginProfile`, `onboardingStatus`, `ownerId`, `scope`, `sortBy`, `sortOrder`
- `POST /resellers` — create a reseller (requires `pricingTierKey`, `marginProfileKey`); accepts profile fields, margin percent, `contacts[]`, and an `onboardingTasks[]` checklist
- `GET /resellers/:resellerId` — reseller detail with contacts, onboarding checklist, registered deals, performance summary, and placeholders (catalog, order tracking, training, certification, support tickets)
- `PATCH /resellers/:resellerId` — partial update; owner-only mutations allowed for assign permission; syncs contacts and onboarding tasks
- `DELETE /resellers/:resellerId` — soft-delete the reseller and its child records
- `GET /resellers/:resellerId/deals` — registered deals for the reseller
- `POST /resellers/:resellerId/deals` — register a deal (requires `name`); optional opportunity/account/lead links and per-deal margin percent
- `PATCH /resellers/:resellerId/deals/:dealId` — update a registered deal (stage, amount, margin, links)

## Support Ticketing Routes (Phase 15)

All routes require one of the `support.*` permissions and are tenant-scoped with owner/team/all visibility (`mine` matches owner or assignee).

- `GET /support/options` — owners, accounts, contacts, ticket status/priority/category/source option sets, knowledge categories, SLA policies, available scopes
- `GET /support/dashboard` — total/open/resolved/unassigned/escalated/SLA-breached counts, status and priority distribution, knowledge article count
- `GET /support/sla-policies` — configured SLA policies
- `POST /support/sla-policies` — create an SLA policy (requires `support.configure`/`support.manage_workflow`); fields `name`, `firstResponseMinutes`, `resolutionMinutes`, optional `priorityKey`
- `GET /support/knowledge-articles`, `POST /support/knowledge-articles` — knowledge base list and create
- `GET /support/tickets` — paginated tickets; filters: `search`, `status`, `priority`, `category`, `source`, `assigneeId`, `accountId`, `escalationStatus`, `breachedOnly`, `scope`, `sortBy`, `sortOrder`
- `POST /support/tickets` — create a ticket (requires `subject`); attaching an SLA policy computes first-response and resolution due dates
- `GET /support/tickets/:ticketId` — ticket detail with SLA status, messages, linked articles, root cause, resolution notes, and placeholders (attachments, CSAT, escalation)
- `PATCH /support/tickets/:ticketId` — partial update; assignment-only mutations allowed for assign permission; status transitions maintain `resolved_at`
- `DELETE /support/tickets/:ticketId` — soft-delete the ticket and its child records
- `POST /support/tickets/:ticketId/messages` — add an `internal_note` or `customer_reply`; the first customer reply records the SLA first-response time
- `POST /support/tickets/:ticketId/articles` — link a knowledge article to the ticket

## Customer Success Routes (Phase 16)

All routes require one of the `customer_success.*` permissions and are tenant-scoped with owner/team/all visibility (`mine` matches the CSM owner).

- `GET /customer-success/options` — owners, accounts, segment/lifecycle/risk/expansion/renewal option sets, available scopes
- `GET /customer-success/dashboard` — totals, average health/adoption, at-risk, open escalations, renewals due, contract value, and segment/risk/lifecycle distributions
- `GET /customer-success/dashboards/health` — health averages and risk distribution
- `GET /customer-success/dashboards/renewal` — renewal totals, due-soon, contract/forecast value, renewed/churned, and status distribution
- `GET /customer-success/workspaces/onboarding|scaled|enterprise` — segment-specific workspace metrics and accounts
- `GET /customer-success/accounts` — paginated CS accounts; filters: `search`, `segment`, `lifecycleStage`, `riskStatus`, `csmOwnerId`, `scope`, `sortBy`, `sortOrder`
- `POST /customer-success/accounts` — create a CS account (requires `accountId`); profile fields, health/adoption scores, renewal date, contract value
- `GET /customer-success/accounts/:csAccountId` — detail with onboarding/success plans, health scores, adoption metrics, QBRs, renewals, escalations, and placeholders
- `PATCH /customer-success/accounts/:csAccountId` — partial update; owner-only mutations allowed for assign permission
- `DELETE /customer-success/accounts/:csAccountId` — soft-delete the account and child records
- `PUT /customer-success/accounts/:csAccountId/onboarding-plan` — upsert the onboarding plan and milestone checklist
- `PUT /customer-success/accounts/:csAccountId/success-plan` — upsert the strategic success plan and stakeholder map
- `POST /customer-success/accounts/:csAccountId/health-scores` — record a health score (updates the account's denormalized score)
- `POST /customer-success/accounts/:csAccountId/adoption-metrics` — add an adoption metric
- `POST /customer-success/accounts/:csAccountId/qbrs`, `PATCH .../qbrs/:qbrId` — QBR/EBR tracking
- `POST /customer-success/accounts/:csAccountId/renewals`, `PATCH .../renewals/:renewalId` — renewal tracking
- `POST /customer-success/accounts/:csAccountId/escalations`, `PATCH .../escalations/:escalationId` — escalation register (status transitions maintain `resolved_at`)

## Customer Training Routes (Phase 17)

All routes require one of the `training.*` permissions and are tenant-scoped.

- `GET /training/options` — owners, accounts, contacts, category/level option sets, customer success accounts, and programs
- `GET /training/dashboard` — program and assignment totals, completion average, average rating, and category/status distributions
- `GET /training/portal/my-training` — the current user's assignments with assigned/in-progress/completed counts and a recommended-training placeholder
- `GET/POST /training/learners` — customer learner records
- `GET /training/programs` — paginated programs; filters: `search`, `status`, `category`, `ownerId`, `sortBy`, `sortOrder`
- `POST /training/programs` — create a program (requires `title`)
- `GET /training/programs/:programId` — program detail with modules, lessons, assets, average rating, and placeholders
- `PATCH /training/programs/:programId`, `DELETE /training/programs/:programId`
- `POST /training/programs/:programId/modules`, `PATCH .../modules/:moduleId` — module authoring
- `POST .../modules/:moduleId/lessons`, `PATCH .../lessons/:lessonId` — lesson authoring
- `POST .../lessons/:lessonId/assets` — link/upload asset (placeholder)
- `GET /training/assignments` — paginated assignments; filters: `status`, `programId`, `userId`, `accountId`, `csAccountId`
- `POST /training/assignments` — assign a program to a user/contact/account, optionally linking a CS account and onboarding plan
- `GET /training/assignments/:assignmentId` — assignment detail with per-lesson progress
- `PATCH /training/assignments/:assignmentId` — update status, due date, and links
- `POST /training/assignments/:assignmentId/progress` — mark lesson progress; recomputes assignment completion and status
- `POST /training/assignments/:assignmentId/feedback` — submit a rating (1–5) and comments

## Validation and Error Handling

Common behaviors:
- invalid UUIDs return `400 VALIDATION_ERROR`
- cross-tenant owners, accounts, or option values return scoped validation errors
- missing records return `404`
- unauthorized access returns `403 FORBIDDEN`
- assign-only users attempting unsupported edits return `403 AUTHORIZATION_ERROR`
- constrained sales-workspace users trying to mutate another user's lead return `404 LEAD_NOT_FOUND`

## Audit Logging

Shared productivity writes produce CRM audit events such as:
- `lead.note.create`
- `lead.note.edit`
- `lead.activity.create`
- `lead.task.create`
- `lead.task.update`
- `lead.workspace.update`
- `lead.handoff.update`
- `campaign.note.create`
- `campaign.activity.create`
- `campaign.task.create`
- `campaign.member.create`
- `campaign.member.update`
- `campaign.member.delete`
- `campaign.create`
- `campaign.update`
- `campaign.delete`
- `social.create`
- `social.update`
- `social.delete`

Equivalent action patterns apply to `account`, `contact`, `opportunity`, `ticket`, and `customer_success_account`.
