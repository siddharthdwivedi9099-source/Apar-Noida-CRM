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
- rotates/stores a hashed refresh token session
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

Response includes:
- tenant summary
- workspace settings
- theme settings
- module states
- terminology entries
- configuration summary counts

### `GET /tenant-config/settings`

Returns tenant workspace settings.

### `PUT /tenant-config/settings`

Updates tenant workspace settings.

Request body:

```json
{
  "workspaceName": "Sample Tenant Workspace",
  "timezone": "UTC",
  "locale": "en-US",
  "currency": "USD",
  "dateFormat": "MMM d, yyyy",
  "timeFormat": "12h"
}
```

### `GET /tenant-config/theme`

Returns the tenant theme settings.

### `PUT /tenant-config/theme`

Updates tenant theme settings.

Request body:

```json
{
  "logo": null,
  "primaryColor": "#f97316",
  "secondaryColor": "#bae6fd",
  "accentColor": "#14b8a6",
  "mode": "light",
  "sidebarStyle": "glass",
  "cardStyle": "glass",
  "fontPreference": "modern",
  "density": "comfortable"
}
```

### `GET /tenant-config/modules`

Returns tenant module states.

### `PUT /tenant-config/modules`

Updates tenant module enablement.

Request body:

```json
{
  "modules": [
    {
      "moduleKey": "leads",
      "enabled": true
    },
    {
      "moduleKey": "support",
      "enabled": false
    }
  ]
}
```

### `GET /tenant-config/terminology`

Returns tenant terminology entries.

### `PUT /tenant-config/terminology`

Updates tenant terminology labels.

Request body:

```json
{
  "terminology": [
    {
      "moduleKey": "leads",
      "singular": "Prospect",
      "plural": "Prospects",
      "description": "Early-stage demand records."
    }
  ]
}
```

### `GET /tenant-config/custom-fields`

Returns active tenant custom-field metadata.

Optional query params:
- `moduleKey`
- `entityKey`

### `POST /tenant-config/custom-fields`

Creates a tenant custom field definition.

Request body example:

```json
{
  "moduleKey": "leads",
  "entityKey": "lead",
  "label": "Campaign Focus",
  "dataType": "text",
  "isRequired": false,
  "isActive": true,
  "sortOrder": 0
}
```

### `PATCH /tenant-config/custom-fields/:fieldId`

Updates custom-field metadata.

### `DELETE /tenant-config/custom-fields/:fieldId`

Soft-deletes a custom field definition.

### `GET /tenant-config/option-sets`

Returns active tenant option sets and values.

### `PUT /tenant-config/option-sets/:setKey`

Replaces an option set and its active values.

This endpoint supports tenant-configurable:
- dropdown values
- pipeline stages
- ticket statuses
- customer-success stages

### `GET /tenant-config/form-layouts`

Returns tenant form-layout metadata.

## Error Behavior

Current conventions:
- `400` for validation errors
- `401` for authentication failures
- `403` for permission failures
- `404` for missing tenant-scoped records
- `409` for conflicting role or custom-field operations
- `429` for login rate limiting
- `500` for unexpected server errors

Authentication and tenant-scoped admin responses intentionally avoid leaking sensitive identity details.
