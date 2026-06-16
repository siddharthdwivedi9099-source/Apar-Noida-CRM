# Admin Guide

## Purpose

This guide covers the current tenant-admin workflow through Phase 5.

## Local Bootstrap

### 1. Start infrastructure

Ensure PostgreSQL is reachable on `DATABASE_URL`.

The repository includes `docker-compose.yml` with:
- PostgreSQL
- Redis
- MinIO

For the default local PostgreSQL service:

```text
postgresql://crm:crm@localhost:5433/crm
```

### 2. Run migrations

```bash
npm run db:migrate
```

### 3. Run seeds

```bash
npm run db:seed
```

The seed now creates:
- the default tenant
- the RBAC permission catalog
- seeded role templates and tenant roles
- the bootstrap admin user
- tenant workspace settings
- tenant theme defaults
- module configuration defaults
- terminology defaults
- seeded option sets
- seeded form-layout metadata

### 4. Start the applications

```bash
npm run dev
```

Frontend:

```text
http://127.0.0.1:5173
```

API:

```text
http://127.0.0.1:4000/api/v1
```

### 5. Sign in

Open:

```text
http://127.0.0.1:5173/login
```

Default bootstrap credentials:
- tenant slug: `sample-tenant`
- email: `admin@sample-tenant.local`
- password: `ChangeMe123!`

## Current Admin Routes

Implemented admin pages:
- `/admin`
- `/admin/theme`
- `/admin/modules`
- `/admin/terminology`
- `/admin/custom-fields`
- `/admin/rbac`

## Current Admin Capabilities

### Tenant settings

Admins can now:
- update workspace name
- update timezone, locale, and formatting defaults

### Theme settings

Admins can now:
- update logo URL
- update primary, secondary, and accent colors
- switch light/dark mode
- change sidebar style
- change card style
- change font preference
- change layout density

Theme changes apply to the live shell after save.

### Module settings

Admins can now:
- enable or disable modules per tenant
- immediately affect navigation visibility
- immediately affect route availability

The `admin` module remains locked on so the tenant does not disable its own governance surface.

### Terminology settings

Admins can now:
- rename business-facing labels such as Leads, Accounts, and Tickets
- update singular/plural terminology
- see those changes reflected in navigation and module copy

### Custom-field foundation

Admins can now:
- create custom field metadata
- update field metadata
- soft delete custom fields
- associate fields with tenant option sets
- review seeded form-layout metadata

### RBAC

Admins can still:
- create roles
- edit role metadata
- assign permissions to roles
- assign roles to users
- delete non-system roles

## Recommended Admin Workflow

Suggested order for a fresh tenant:
1. Verify login with the seeded admin account.
2. Review `/admin` and update workspace settings.
3. Open `/admin/theme` and apply tenant branding.
4. Open `/admin/modules` and disable modules not needed for the rollout.
5. Open `/admin/terminology` and align business language.
6. Open `/admin/custom-fields` and prepare metadata for later CRM forms.
7. Open `/admin/rbac` and adjust roles or assignments as needed.

## Security and Governance Notes

Current protections:
- admin APIs require valid access tokens
- admin APIs require matching `admin.*` permissions
- configuration writes create audit-log entries
- disabled modules are blocked even if a user still has matching module permissions
- custom fields use soft delete rather than destructive removal

## Password Rotation for the Seeded Admin

Update `DEFAULT_ADMIN_PASSWORD` in the environment and rerun:

```bash
npm run db:seed
```

The seed remains idempotent and updates the bootstrap admin password hash.

## Current Limits

Still intentionally out of scope:
- public self-signup
- password reset workflows
- admin-created user onboarding UI
- business-module CRUD for leads, accounts, and contacts
- visual form rendering from custom-field metadata
