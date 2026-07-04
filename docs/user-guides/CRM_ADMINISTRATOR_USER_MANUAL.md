# CRM Administrator User Manual

## Overview

**Persona:** CRM Administrator

**Who you are:** a tenant-level CRM administrator responsible for operational workspace configuration, user management, data hygiene, and governance within your organization.

**Primary scope:**
- Tenant-level configuration and administration
- User and role management
- Module enable/disable and workspace terminology
- Option set maintenance and custom fields
- Workflow and automation governance
- Audit review and AI governance visibility

---

## Seeded demo credentials

- **Email:** `crm.admin@apar-elite.com`
- **Password:** `AparAdmin@2026!` (or the shared demo password used by your environment)
- **Role:** `CRM Admin`
- **Main landing area:** `/admin`

---

## Key responsibilities

### Admin configuration
- Manage tenant configuration from `/admin`.
- Access RBAC, modules, theme, terminology, custom fields, and audit logs.
- Use `/admin/configuration` when available to manage configuration drafts, validation, publish, and rollback.

### User and role management
- Create, edit, and assign roles in **Administration → Roles & Permissions**.
- Grant the least privilege needed for each user.
- Combine roles when a user needs multiple capability sets.
- Monitor user assignments and adjust as business needs change.

### Module and feature toggles
- Enable or disable modules from **Administration → Modules**.
- Disabling a module removes it from all users' navigation while preserving data.
- Typical actions:
  - Turn off unused modules like `social`, `resellers`, or `training` if they are not needed.
  - Keep `admin` enabled so configuration screens remain available.

### Terminology and branding
- Rename object labels from **Administration → Terminology**.
- Align terminology to your business vocabulary (for example, `Opportunities` → `Deals`).
- Update theme colors and logo to match tenant branding.

### Option sets and dropdown maintenance
- Manage picklists for statuses, stages, sources, priorities, ticket categories, and more.
- Retire old values safely instead of deleting them.
- Keep dropdown options aligned with your sales, service, and success processes.

### Custom fields and page layouts
- Add and retire custom fields from the admin configuration.
- Set custom fields inactive to hide them without losing historic data.
- Control which fields appear on forms and detail pages.

### Workflow and automation governance
- Review workflows in `/workflows`.
- Pause or disable workflows without deleting them.
- Ensure automations are aligned with tenant business rules.
- Manage workflow activation status (draft / active / inactive).

### Audit and governance
- Review audit logs for changes to:
  - roles and permissions
  - module toggles and terminology
  - configuration publish/rollback
  - AI and workflow actions
- Use audit logs to trace authorized activity and confirm compliance.

---

## Practical workflows

### 1. Onboard a new internal user
1. Open **Administration → Roles & Permissions**.
2. Create or select the appropriate role for the new hire.
3. Assign the role to the user.
4. Confirm the user signs in and sees only their permitted screens.

### 2. Tune tenant terminology
1. Open `/admin/terminology`.
2. Rename objects to match your company vocabulary.
3. Save changes.
4. Verify labels update across the tenant.

### 3. Clean up option sets
1. Open the relevant admin option-set page.
2. Retire outdated statuses, stages, or categories.
3. Save your changes.
4. Confirm dropdowns now show the cleaned list.

### 4. Manage module availability
1. Open `/admin/modules`.
2. Turn off any modules your organization does not use.
3. Save the changes.
4. Confirm disabled modules disappear from user navigation.

### 5. Review audit logs regularly
1. Visit `/logs` or the audit area.
2. Filter by admin activity, RBAC, configuration, and AI.
3. Verify changes were made by authorized users.

---

## AI and agent governance

### AI governance visibility
- CRM Admin can see AI configuration and usage if permissions allow.
- Review AI action history and whether AI outputs require human approval.
- Confirm AI changes are audit-logged.

### Agent configurability
- The platform supports an agent registry and managed AI prompts.
- When permitted, CRM Admin can:
  - edit agent metadata
  - update descriptions
  - adjust agent prompt templates
  - configure AI-related settings through the UI

### Practical AI responsibilities
- Help users enable AI assistance where it adds value.
- Review AI-generated summaries, drafts, and recommendations.
- Enforce human review for sensitive AI outputs.
- Ensure AI provider settings match tenant governance.

---

## Permissions and role guidance

### Core admin permissions
- `admin.view`: view admin screens and dashboards.
- `admin.edit`: make tenant-level changes.
- `admin.configure`: full tenant configuration authority.
- `admin.assign`: assign roles to users.
- `admin.create`: create roles and configuration objects.
- `admin.delete`: remove roles and configuration objects.

### Recommended usage
- Use `admin.view` for audit and review access.
- Use `admin.edit` for everyday configuration changes.
- Reserve `admin.configure` for senior CRM administrators.
- Use `admin.assign` for user role management without giving full admin powers.

---

## Best practices

- Grant the least privilege necessary for each user.
- Use terminology settings rather than code changes.
- Retire old option values instead of deleting them.
- Save workflows as drafts before activating them.
- Require a change reason whenever possible.
- Use audit logs proactively to detect improper changes.
- Work with your Super Admin for system-level or platform-level decisions.

---

## Differences from Super Admin

- CRM Admin is tenant-scoped and focused on operational configuration.
- Super Admin has platform-level and cross-tenant powers.
- CRM Admin manages tenant configuration, users, roles, workflows, and audit review.
- CRM Admin does not generally manage system-wide deployment, backups, or cross-tenant tenant administration.

---

## Quick reference

- `/admin/rbac` — user and role management
- `/admin/modules` — enable/disable modules
- `/admin/terminology` — rename tenant labels
- `/admin/custom-fields` — customize forms
- `/admin/configuration` — manage configuration drafts, validation, publish, rollback
- `/workflows` — manage automation status
- `/ai/agents` — configure AI agents if available
- `/logs` — review audit history

---

## Notes

- This guide is aligned with the CRM platform's configuration engine and admin modules.
- Audit logging is built in for admin actions, AI actions, and workflow configuration changes.
- Always validate configuration changes in a safe environment before applying them broadly.
