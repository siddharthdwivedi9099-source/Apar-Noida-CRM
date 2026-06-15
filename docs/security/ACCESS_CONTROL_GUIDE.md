# Access Control Guide

## Purpose

This guide explains the current access-control foundation that now exists in code.

## Current Access-Control Layers

### Authentication

- users sign in with `tenantSlug`, email, and password
- the backend issues an access token and refresh token
- protected API routes require a valid access token and an active backing session

### Authorization Data Model

The schema uses:
- `roles`
- `permissions`
- `role_permissions`
- `user_roles`

Current model:
- permissions are global catalog entries
- roles are tenant-scoped
- users receive roles within a tenant
- roles map to permissions within a tenant

### Frontend Protection

The web app now:
- loads current auth state during startup
- redirects unauthenticated users to `/login`
- keeps the shell routes behind a protected route gate
- exposes logout from the top bar

## Seeded Access

The core seed creates:
- the `tenant-admin` role
- the global permission catalog
- a default admin user
- the admin role assignment for that user

## Current Permission Philosophy

The present implementation establishes the structure but does not yet enforce fine-grained permissions on module APIs.

What exists now:
- permission catalog
- role assignment model
- middleware-authenticated user identity
- current-user endpoint for downstream UI and API decisions

What still needs later enforcement work:
- role checks on each business endpoint
- route or menu trimming by permission
- record-level ownership rules
- field-level redaction

## Relationship to RBAC Matrix

The intended capability direction still lives in [RBAC_MATRIX.md](./RBAC_MATRIX.md).

The current schema is the persistence foundation that future RBAC enforcement will use.
