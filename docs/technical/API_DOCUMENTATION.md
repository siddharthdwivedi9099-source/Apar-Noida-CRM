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

## CRM Foundations

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
- `opportunity`
- `ticket`
- `customer_success_account`

Permission checks map to module families:
- `lead` -> `leads.*`
- `account` -> `accounts.*`
- `contact` -> `contacts.*`
- `opportunity` -> `opportunities.*`
- `ticket` -> `support.*`
- `customer_success_account` -> `customer_success.*`

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

### `PATCH /records/:entityType/:entityId/tasks/:taskId`

Updates task ownership, assignee, status, priority, due date, reminder, description, title, and metadata merge.

Assign-only users may only update:
- `ownerId`
- `assigneeId`
- `status`

## Compatibility CRM Routes

The original Phase 6 routes remain available for lead, account, and contact note and activity creation:
- `POST /leads/:leadId/notes`
- `POST /leads/:leadId/activities`
- `POST /accounts/:accountId/notes`
- `POST /accounts/:accountId/activities`
- `POST /contacts/:contactId/notes`
- `POST /contacts/:contactId/activities`

These now use the shared productivity service behavior internally.

## Validation and Error Handling

Common behaviors:
- invalid UUIDs return `400 VALIDATION_ERROR`
- cross-tenant owners, accounts, or option values return scoped validation errors
- missing records return `404`
- unauthorized access returns `403 FORBIDDEN`
- assign-only users attempting unsupported edits return `403 AUTHORIZATION_ERROR`

## Audit Logging

Shared productivity writes produce CRM audit events such as:
- `lead.note.create`
- `lead.note.edit`
- `lead.activity.create`
- `lead.task.create`
- `lead.task.update`

Equivalent action patterns apply to `account`, `contact`, `opportunity`, `ticket`, and `customer_success_account`.
