# Admin Guide

## Purpose

This guide covers the current administrative workflow for local and early-stage tenant operation.

## Bootstrap Workflow

### 1. Start PostgreSQL

Ensure PostgreSQL is reachable on `DATABASE_URL`.

The repository includes `docker-compose.yml`, but Docker must actually be running before that service can be used.

### 2. Run migrations

```bash
npm run db:migrate
```

### 3. Run seeds

```bash
npm run db:seed
```

This seed now creates:
- the default tenant
- the full RBAC permission catalog
- seeded role templates
- seeded tenant roles
- the bootstrap admin user

### 4. Start the applications

```bash
npm run dev
```

If you access the frontend as `http://localhost:5173` instead of `http://127.0.0.1:5173`, keep `API_CORS_ORIGIN` aligned. The default local config allows both origins.

### 5. Sign in

Open:

```text
http://127.0.0.1:5173/login
```

Default bootstrap credentials:
- tenant slug: `sample-tenant`
- email: `admin@sample-tenant.local`
- password: `ChangeMe123!`

## Current Admin Capabilities

Implemented today:
- sign in and maintain an authenticated session
- load current user and permission context
- view the permission catalog and seeded role templates
- create tenant roles
- edit role metadata
- assign permissions to roles
- assign roles to existing users
- delete non-system roles

Current protections:
- permission middleware blocks unauthorized RBAC API calls
- the admin UI hides or disables controls when the user lacks the matching `admin.*` permission
- the API prevents the current admin from removing their own active administrative access during role reassignment

## Using the Admin UI

### Create a role

1. Open `/admin`
2. Pick a template or leave the form in custom mode
3. Enter the role name, slug, and description
4. Save the role

### Assign permissions to a role

1. Select the role from the tenant role list
2. Review the module-grouped permission matrix
3. Toggle permission checkboxes
4. Save permissions

### Assign roles to a user

1. Select a user in the user-assignment section
2. Toggle the roles that should apply
3. Save the assignment

## Rotating the Seeded Admin Password

Update `DEFAULT_ADMIN_PASSWORD` in the environment and rerun:

```bash
npm run db:seed
```

The seed is idempotent and will update the bootstrap admin password hash.

## What Is Still Out of Scope

Not implemented yet:
- public self-signup
- admin-created user onboarding UI
- password reset workflows
- CRM business CRUD backed by live module APIs
- record-level authorization rules
