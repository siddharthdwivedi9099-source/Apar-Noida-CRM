# API Documentation

## Base URL

Local default:

```text
http://127.0.0.1:4000/api/v1
```

## Current Endpoints

### `GET /`

Returns API phase and version metadata.

### `GET /health`

Returns service health plus dependency state.

Database status is now live rather than placeholder-only.

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

Response:

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
        "slug": "tenant-admin",
        "name": "Tenant Admin"
      }
    ],
    "permissionCodes": ["users.manage", "roles.manage"],
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

## Error Behavior

Current error conventions:
- `400` for validation failures
- `401` for authentication failures
- `429` for login rate limiting
- `500` for unexpected server errors

Authentication responses intentionally avoid leaking whether the tenant, email, or password was the exact failure point.
