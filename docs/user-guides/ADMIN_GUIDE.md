# Admin Guide

## Purpose

This guide covers the current administrative bootstrap workflow for local and early-stage environments.

## Current Admin Workflow

### 1. Start PostgreSQL

Ensure PostgreSQL is reachable on `DATABASE_URL`.

The repository includes a `docker-compose.yml` definition, but Docker must actually be running before that service can be used.

### 2. Run migrations

```bash
npm run db:migrate
```

### 3. Run seeds

```bash
npm run db:seed
```

### 4. Start the applications

```bash
npm run dev
```

If you access the frontend as `http://localhost:5173` instead of `http://127.0.0.1:5173`, keep `API_CORS_ORIGIN` aligned. The local default now allows both origins.

### 5. Sign in

Open:

```text
http://127.0.0.1:5173/login
```

Default bootstrap credentials:
- tenant slug: `sample-tenant`
- email: `admin@sample-tenant.local`
- password: `ChangeMe123!`

## Rotating the Seeded Admin Password

Update `DEFAULT_ADMIN_PASSWORD` in the environment and rerun:

```bash
npm run db:seed
```

The seed is idempotent and will update the bootstrap admin user password hash.

## What Admins Can Do Today

Implemented today:
- sign in
- maintain an authenticated session
- sign out
- load current user context
- inherit the seeded `tenant-admin` role and permission catalog

Not implemented yet:
- admin UI for creating users
- password reset flows
- role editing UI
- tenant settings UI
- public self-signup
