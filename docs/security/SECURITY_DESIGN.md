# Security Design

## Current Security Posture

The repository now includes the first implemented security controls rather than only design intent.

Implemented in code today:
- password hashing through PostgreSQL `pgcrypto`
- JWT access tokens
- JWT refresh tokens with database-backed rotation
- hashed refresh token storage in `auth_sessions`
- HTTP-only refresh token cookie
- credentialed CORS support for the web client origin list
- auth middleware for protected API routes
- login rate limiting
- failed login tracking and timed account lockout
- audit logging for auth lifecycle events
- environment-based secrets for access and refresh token signing
- tenant-aware current-user resolution
- generic authentication error responses

## Authentication Controls

### Access Tokens

- short-lived JWTs
- signed with `JWT_ACCESS_TOKEN_SECRET`
- include `tenantId`, `sessionId`, and subject user id

### Refresh Tokens

- signed with `JWT_REFRESH_TOKEN_SECRET`
- rotated on refresh
- hashed before persistence
- stored in `auth_sessions`
- revoked on logout or invalid refresh-session use

### Password Handling

- passwords are stored as hashes, never plaintext
- the current implementation uses `crypt(..., gen_salt('bf', 12))`
- the seeded admin password should be changed through environment configuration in any non-local environment

## Abuse Protection

The login flow currently has two layers:
- endpoint rate limiting by tenant, email, and IP window
- user-level failed login counting with timed lockout

## Audit and Traceability

Authentication events capture:
- actor user when known
- tenant when known
- session id when known
- request id
- IP and user agent
- structured failure reason metadata

## Secrets and Environment

Sensitive runtime values now include:
- `JWT_ACCESS_TOKEN_SECRET`
- `JWT_REFRESH_TOKEN_SECRET`
- `DEFAULT_ADMIN_PASSWORD`
- `DATABASE_URL`
- `API_CORS_ORIGIN`

These must not remain at development defaults outside local use.

## Current Gaps

Still not implemented:
- MFA
- SSO or enterprise identity federation
- CSRF-specific hardening for cross-site deployments
- record-level or field-level authorization
- secrets manager integration
- automated dependency and secret scanning in CI

## Production Configuration Hardening (2026-06-23 review)

The API enforces secure configuration at startup. When `NODE_ENV=production`, `apps/api/src/config/env.ts` refuses to boot if any of the following is true:
- `JWT_ACCESS_TOKEN_SECRET` or `JWT_REFRESH_TOKEN_SECRET` still equals its development default
- the access and refresh JWT secrets are identical
- `DEFAULT_ADMIN_PASSWORD` still equals the documented default
- `AUTH_COOKIE_SECURE` is not `true` (the refresh cookie must be HTTPS-only)

This prevents a production deployment from silently running with known secrets or an insecure refresh cookie. Development and test environments are unaffected.

## Design Direction for Next Phases

Future security work should prioritize:
- administrative user creation workflows
- RBAC enforcement on business endpoints
- CSRF strategy for production cookie usage
- tenant-aware business audit trails
- operational alerting for suspicious auth activity
- AI gateway rate-limit enforcement and a shared (Redis-backed) rate-limit store for multi-replica deployments

See [SECURITY_REVIEW_REPORT.md](./SECURITY_REVIEW_REPORT.md) for the full 2026-06-23 security review.
