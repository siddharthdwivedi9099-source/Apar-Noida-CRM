# Multi-Tenancy Design

## Purpose

This document explains how multi-tenancy is currently implemented through Phase 5 and how tenant-specific configuration now participates in runtime behavior.

## Current Isolation Model

The platform uses a shared PostgreSQL database with logical tenant isolation.

Primary isolation rules:
- every tenant has a row in `tenants`
- tenant-owned records carry `tenant_id`
- related tables use composite foreign keys where helpful
- application code always resolves tenant context before protected operations

## Tenant Scope Today

### Tenant-Owned Core Tables

Current tenant-owned operational tables:
- `users`
- `teams`
- `departments`
- `roles`
- `role_permissions`
- `user_roles`
- `auth_sessions`

### Tenant-Owned Configuration Tables

Phase 5 adds tenant-owned configuration tables:
- `tenant_option_sets`
- `tenant_option_values`
- `custom_field_definitions`
- `custom_form_layouts`

### Hybrid Tables

Hybrid tables may be global or tenant-specific:
- `system_settings`
- `audit_logs`

Shared platform tables remain:
- `permissions`
- `role_templates`
- `role_template_permissions`
- `schema_migrations`
- `seed_runs`

## Tenant Resolution

### Authentication

The current login boundary is tenant-first:
- users log in with `tenantSlug + email + password`
- the API resolves the tenant from `tenantSlug`
- access tokens carry `tenantId`
- refresh sessions are stored with both `tenant_id` and `user_id`

### Request Processing

For protected routes:
1. JWT access token is verified
2. backing refresh session is checked
3. `request.auth` is populated with `tenantId`, `userId`, `sessionId`, roles, and permission codes
4. downstream services scope queries by `tenantId`

## Tenant Configuration as Runtime Isolation

Phase 5 extends multi-tenancy beyond data ownership into workspace behavior.

The tenant now controls:
- workspace name and locale defaults
- theme and branding
- module enable/disable state
- terminology labels
- option catalogs such as pipeline stages and ticket statuses
- custom field metadata
- form layout metadata

This means two tenants can share the same deployed code while seeing:
- different branding
- different navigation
- different business language
- different configuration catalogs for future CRM forms

## Configuration Storage Strategy

### Document-Style Settings

Tenant document settings are stored in `system_settings` under keys such as:
- `tenant.settings`
- `tenant.theme`
- `tenant.modules`
- `tenant.terminology`

This supports flexible evolution without frequent schema churn.

### Structured Metadata

Structured metadata is stored in dedicated tables when the data needs CRUD semantics, soft delete, or later joins:
- custom fields
- form layouts
- option sets and option values

## Runtime Enforcement

### API Enforcement

Tenant configuration APIs:
- require authenticated tenant context
- scope writes to `request.auth.tenantId`
- never update another tenant's records
- write audit logs for configuration changes

### Frontend Enforcement

The frontend bootstraps tenant configuration after auth and uses it to:
- hide disabled modules
- block disabled module routes
- render tenant terminology
- apply tenant theme tokens

### RBAC + Tenant Switches

Module access now requires both:
- matching RBAC permissions
- module enabled for the tenant

This is an intentional two-layer model:
- RBAC controls who may use a capability
- tenant configuration controls whether the capability is available in that tenant at all

## Seeded Tenant Defaults

The default tenant bootstrap now seeds:
- workspace settings
- theme defaults
- terminology defaults
- module enablement defaults
- option sets for dropdowns, pipeline stages, ticket statuses, and customer-success stages
- default form-layout metadata

This allows a new tenant to boot with a coherent, fully isolated workspace configuration from day one.

## Current Limits

Still intentionally out of scope:
- subdomain-based tenant resolution
- custom-domain tenant routing
- cross-tenant memberships
- platform operator cross-tenant tooling
- PostgreSQL row-level security policies
- per-tenant infrastructure isolation

## Next Steps

Future phases should:
- apply tenant configuration to real CRM entity forms
- enforce tenant isolation across leads, accounts, and contacts
- propagate tenant context into async jobs and workflow engines
- add optional higher-isolation strategies for regulated deployments
