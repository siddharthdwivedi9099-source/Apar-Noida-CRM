# API Documentation

## Base URL

Local default:

```text
http://127.0.0.1:4000/api/v1
```

Browser clients use cookie-backed refresh flows, so the API must allow credentialed CORS for the configured web origin list in `API_CORS_ORIGIN`.

## Current Endpoints

### `GET /`

Returns API phase and version metadata.

### `GET /health`

Returns service health plus dependency state.

## Authentication Endpoints

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

Response shape:

```json
{
  "user": {
    "id": "uuid",
    "email": "admin@sample-tenant.local",
    "firstName": "Platform",
    "lastName": "Admin",
    "displayName": "Platform Admin",
    "status": "active",
    "tenant": {
      "id": "uuid",
      "slug": "sample-tenant",
      "name": "Sample Tenant"
    },
    "roles": [
      {
        "id": "uuid",
        "slug": "super-admin",
        "name": "Super Admin"
      }
    ],
    "permissionCodes": [
      "admin.view",
      "admin.assign",
      "dashboards.view_dashboard",
      "ai.manage_ai"
    ],
    "metadata": {}
  },
  "session": {
    "id": "uuid",
    "expiresAt": "2026-06-30T10:00:00.000Z",
    "lastSeenAt": "2026-06-15T10:00:00.000Z"
  },
  "tokens": {
    "tokenType": "Bearer",
    "accessToken": "jwt",
    "accessTokenExpiresAt": "2026-06-15T10:15:00.000Z",
    "refreshTokenExpiresAt": "2026-06-30T10:00:00.000Z"
  }
}
```

Behavior:
- also sets an HTTP-only refresh token cookie
- writes success or failure audit logs
- applies rate limiting and failed-login handling
- is intended to be called with `credentials: include` from the web app

### `POST /auth/refresh`

Rotates the refresh token and returns a new access token.

Request:
- normally uses the HTTP-only cookie
- also accepts `{ "refreshToken": "..." }` in the body as a fallback

### `POST /auth/logout`

Revokes the active session when a valid access token or refresh token is available and clears the refresh token cookie.

### `GET /auth/me`

Returns the current authenticated user and active session summary.

Requires:

```text
Authorization: Bearer <access-token>
```

## RBAC Endpoints

All RBAC routes require a valid access token.

### `GET /rbac/catalog`

Returns:
- permission modules
- permission action categories
- the current permission catalog
- seeded role templates

Requires one of:
- `admin.view`
- `admin.configure`

### `GET /rbac/roles`

Returns all active tenant roles with:
- role metadata
- resolved permission list
- permission codes
- active user count

Requires one of:
- `admin.view`
- `admin.configure`

### `POST /rbac/roles`

Creates a tenant role or restores a soft-deleted role with the same slug.

Request body:

```json
{
  "name": "Growth Analyst",
  "slug": "growth-analyst",
  "description": "Custom reporting and campaign analysis role.",
  "templateKey": "marketing-executive"
}
```

Requires one of:
- `admin.create`
- `admin.configure`

### `PATCH /rbac/roles/:roleId`

Updates role name, slug, or description.

Requires one of:
- `admin.edit`
- `admin.configure`

### `DELETE /rbac/roles/:roleId`

Soft-deletes a non-system role and soft-deletes its assignments.

Requires one of:
- `admin.delete`
- `admin.configure`

### `PUT /rbac/roles/:roleId/permissions`

Replaces the active permission bundle for a role.

Request body:

```json
{
  "permissionCodes": [
    "marketing.view",
    "marketing.edit",
    "campaigns.view",
    "campaigns.create",
    "dashboards.view_dashboard"
  ]
}
```

Requires one of:
- `admin.assign`
- `admin.configure`

### `GET /rbac/users`

Returns tenant users with:
- current roles
- resolved permission codes
- team and department names when present
- account status and last login timestamps

Requires one of:
- `admin.view`
- `admin.configure`

### `PUT /rbac/users/:userId/roles`

Replaces the active role set for a user.

Request body:

```json
{
  "roleIds": ["uuid-1", "uuid-2"]
}
```

Requires one of:
- `admin.assign`
- `admin.configure`

Behavior:
- soft-deletes removed assignments
- restores matching soft-deleted assignments
- prevents the current admin from removing their own active administrative access in the same session

## Error Behavior

Current error conventions:
- `400` for validation failures or invalid permission/role input
- `401` for authentication failures
- `403` for permission failures
- `404` when a requested role or user does not exist
- `409` for protected or conflicting role operations
- `429` for login rate limiting
- `500` for unexpected server errors

Authentication responses intentionally avoid leaking whether the tenant, email, or password was the exact failure point.
