# Admin Guide

## Purpose

This guide covers the current tenant-admin workflow and the operational controls added in later phases where relevant.

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
- `/notifications`
- `/approvals`

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

### Notifications and approvals

Tenant admins and authorized managers can now:
- review the in-app notification center
- manage notification preferences per user session
- review approval inboxes and detail history
- approve or reject requests when they are the assigned approver or hold approval/configure authority
- rely on workflow-generated `send_notification` and `trigger_approval` actions creating real persisted records

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
- notification preference changes, approval creation, approval comments, and approval decisions are audit logged

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

## Workflow automation (Phase 24)

The **Workflows** page (`/workflows`) lets administrators automate processes.

- **Create a workflow** — give it a name, choose a **trigger** (for example *Record created* or *Renewal approaching*), and optionally add a **condition** (field / operator / value).
- **Add actions** — pick from the action catalog (assign owner, create task, send notification/email, update field, change status, trigger approval, call webhook, run AI prompt, run AI agent, create support ticket, assign training, create CS task, trigger renewal playbook). Each action can declare the permission it requires.
- **Activate** — workflows start as drafts; activate (and enable) a workflow before it can run.
- **Run and trace** — run a workflow with a trigger context (JSON) and review the result. Every run is logged with a per-action log, including failures: an action whose required permission the runner lacks is recorded as failed, and AI actions run through the AI Gateway.
- **Run logs** — the detail view lists recent runs and their step-level logs for traceability.

Governance rules enforced: workflow actions respect permissions, runs are logged, failed workflows are traceable, and AI actions go through the AI Gateway.

## Notifications and approvals (Phase 25)

The **Notification center** (`/notifications`) and **Approval inbox** (`/approvals`) are now part of the authenticated workspace.

- **Notifications** — users can review unread alerts, open linked records, and manage in-app notification preferences by type.
- **Role-based delivery** — notifications can target a single user or fan out to every active user holding a role, while still storing read/unread state per recipient.
- **Approvals** — approval requests store approver routing, approval comments, status transitions, and append-only approval history.
- **Workflow integration** — `send_notification` and `trigger_approval` are no longer logged-only effects; they now persist records and surface in the corresponding inboxes.
