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

Authenticates a tenant user.

Request body:

```json
{
  "tenantSlug": "sample-tenant",
  "email": "admin@sample-tenant.local",
  "password": "ChangeMe123!"
}
```

Behavior:
- issues a JWT access token
- rotates and stores a hashed refresh token session
- sets an HTTP-only refresh token cookie
- writes audit logs
- applies rate limiting and failed-login handling

### `POST /auth/refresh`

Rotates the refresh token and returns a new access token.

### `POST /auth/logout`

Revokes the active session and clears the refresh token cookie.

### `GET /auth/me`

Returns the current authenticated user and session summary.

Requires:

```text
Authorization: Bearer <access-token>
```

## RBAC

All RBAC routes require a valid access token.

### `GET /rbac/catalog`

Returns:
- permission modules
- permission actions
- permission catalog
- seeded role templates

Requires one of:
- `admin.view`
- `admin.configure`

### `GET /rbac/roles`

Returns tenant roles with resolved permissions and active user counts.

### `POST /rbac/roles`

Creates a role or restores a matching soft-deleted role slug.

### `PATCH /rbac/roles/:roleId`

Updates role metadata.

### `DELETE /rbac/roles/:roleId`

Soft-deletes a non-system role and its active assignments.

### `PUT /rbac/roles/:roleId/permissions`

Replaces the active permission bundle for a role.

### `GET /rbac/users`

Returns tenant users with roles and resolved permission codes.

### `PUT /rbac/users/:userId/roles`

Replaces the active role set for a user.

## Tenant Configuration

All tenant configuration routes require:

```text
Authorization: Bearer <access-token>
```

Read routes require one of:
- `admin.view`
- `admin.configure`

Write routes require one of:
- `admin.create`
- `admin.edit`
- `admin.delete`
- `admin.configure`

### `GET /tenant-config`

Returns the tenant bootstrap configuration used by the frontend shell.

### `GET /tenant-config/settings`

Returns tenant workspace settings.

### `PUT /tenant-config/settings`

Updates tenant workspace settings.

### `GET /tenant-config/theme`

Returns the tenant theme settings.

### `PUT /tenant-config/theme`

Updates tenant theme settings.

### `GET /tenant-config/modules`

Returns tenant module states.

### `PUT /tenant-config/modules`

Updates tenant module enablement.

### `GET /tenant-config/terminology`

Returns tenant terminology entries.

### `PUT /tenant-config/terminology`

Updates tenant terminology labels.

### `GET /tenant-config/custom-fields`

Returns active tenant custom-field metadata.

Optional query params:
- `moduleKey`
- `entityKey`

### `POST /tenant-config/custom-fields`

Creates a tenant custom field definition.

### `PATCH /tenant-config/custom-fields/:fieldId`

Updates custom-field metadata.

### `DELETE /tenant-config/custom-fields/:fieldId`

Soft-deletes a custom field definition.

### `GET /tenant-config/option-sets`

Returns active tenant option sets and values.

### `PUT /tenant-config/option-sets/:setKey`

Replaces an option set and its active values.

### `GET /tenant-config/form-layouts`

Returns tenant form-layout metadata.

## CRM Endpoints

All CRM routes require:

```text
Authorization: Bearer <access-token>
```

Every CRM route is tenant-scoped and uses soft-delete-aware reads.

## Leads

### `GET /leads/options`

Returns:
- assignable owners
- lead statuses
- lead sources

Requires any active `leads.*` permission.

### `GET /leads`

Returns paginated leads.

Supported query params:
- `page`
- `pageSize`
- `search`
- `status`
- `source`
- `ownerId`
- `sortBy`: `createdAt | updatedAt | companyName | status | source | score | owner`
- `sortOrder`: `asc | desc`

### `POST /leads`

Creates a lead.

Requires one of:
- `leads.create`
- `leads.configure`

Request body example:

```json
{
  "firstName": "Riley",
  "lastName": "Shah",
  "companyName": "Northwind Labs",
  "email": "riley@northwind.test",
  "phone": "+1-415-555-0101",
  "statusKey": "new",
  "sourceKey": "website",
  "score": 42,
  "ownerId": null
}
```

### `GET /leads/:leadId`

Returns the lead plus:
- notes
- activities
- conversion placeholder metadata

### `PATCH /leads/:leadId`

Updates a lead.

Requires one of:
- `leads.edit`
- `leads.assign`
- `leads.configure`

Assignment-only actors can only update `ownerId`.

### `DELETE /leads/:leadId`

Soft-deletes a lead.

### `POST /leads/:leadId/notes`

Creates a note for the lead.

### `POST /leads/:leadId/activities`

Creates an activity for the lead.

## Accounts

### `GET /accounts/options`

Returns:
- assignable owners
- account types
- account health placeholders

Requires any active `accounts.*` permission.

### `GET /accounts`

Returns paginated accounts.

Supported query params:
- `page`
- `pageSize`
- `search`
- `accountType`
- `industry`
- `ownerId`
- `sortBy`: `createdAt | updatedAt | name | accountType | industry | owner`
- `sortOrder`: `asc | desc`

### `POST /accounts`

Creates an account.

Requires one of:
- `accounts.create`
- `accounts.configure`

### `GET /accounts/:accountId`

Returns the account plus:
- notes
- activities
- related contacts
- related opportunities placeholder metadata

### `PATCH /accounts/:accountId`

Updates an account.

Requires one of:
- `accounts.edit`
- `accounts.assign`
- `accounts.configure`

Assignment-only actors can only update `ownerId`.

### `DELETE /accounts/:accountId`

Soft-deletes an account.

### `POST /accounts/:accountId/notes`

Creates a note for the account.

### `POST /accounts/:accountId/activities`

Creates an activity for the account.

## Contacts

### `GET /contacts/options`

Returns:
- assignable owners
- contact roles
- active accounts for relationship assignment

Requires any active `contacts.*` permission.

### `GET /contacts`

Returns paginated contacts.

Supported query params:
- `page`
- `pageSize`
- `search`
- `accountId`
- `role`
- `ownerId`
- `sortBy`: `createdAt | updatedAt | name | email | account | role | owner`
- `sortOrder`: `asc | desc`

### `POST /contacts`

Creates a contact.

Requires one of:
- `contacts.create`
- `contacts.configure`

### `GET /contacts/:contactId`

Returns the contact plus:
- notes
- activities
- related account summary

### `PATCH /contacts/:contactId`

Updates a contact.

Requires one of:
- `contacts.edit`
- `contacts.assign`
- `contacts.configure`

Assignment-only actors can only update `ownerId`.

### `DELETE /contacts/:contactId`

Soft-deletes a contact.

### `POST /contacts/:contactId/notes`

Creates a note for the contact.

### `POST /contacts/:contactId/activities`

Creates an activity for the contact.

## Error Behavior

Current conventions:
- `400` for validation errors and invalid tenant option references
- `401` for authentication failures
- `403` for permission failures
- `404` for missing tenant-scoped records
- `409` for conflicting role or custom-field operations
- `429` for login rate limiting
- `500` for unexpected server errors
