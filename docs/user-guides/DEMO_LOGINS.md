# Role-Based Demo Logins (RBAC)

A demo user exists for **every canonical role** so you can sign in and see exactly what each role can and cannot do (RBAC is enforced per role).

## How to create / refresh them

```bash
npm run db:seed              # ensure roles exist (core seed)
npm run db:seed:demo-users   # create one active login per role (idempotent)
```

The seeder (`scripts/seed-demo-users.mjs`) is idempotent — re-running resets the demo users' password and role assignment. Override the shared password with `DEMO_USER_PASSWORD=... npm run db:seed:demo-users`.

## Signing in

- **Tenant:** `sample-tenant`
- **Password (all demo users):** `Demo@1234`
- **Email:** see the table below

## The logins

| Role | Email | Approx. permissions |
|------|-------|---------------------|
| Super Admin | `super.admin@sample-tenant.local` | full (≈299) |
| CRM Admin | `crm.admin@sample-tenant.local` | admin/config |
| Sales Manager | `sales.manager@sample-tenant.local` | ≈59 |
| Sales Executive | `sales.executive@sample-tenant.local` | sales |
| Sales Head | `sales.head@sample-tenant.local` | sales leadership |
| Sales Leader | `sales.leader@sample-tenant.local` | sales leadership |
| Sales Development Representative | `sales.development.representative@sample-tenant.local` | SDR |
| SDR Manager | `sdr.manager@sample-tenant.local` | SDR mgmt |
| Inside Sales Executive | `inside.sales.executive@sample-tenant.local` | inside sales |
| Inside Sales Manager | `inside.sales.manager@sample-tenant.local` | inside sales mgmt |
| Marketing Manager | `marketing.manager@sample-tenant.local` | ≈32 |
| Marketing Executive | `marketing.executive@sample-tenant.local` | marketing |
| Social Media Marketing Manager | `social.media.marketing.manager@sample-tenant.local` | social mgmt |
| Social Media Marketing Executive | `social.media.marketing.executive@sample-tenant.local` | social |
| Business Development Manager | `business.development.manager@sample-tenant.local` | BD mgmt |
| Business Development Executive | `business.development.executive@sample-tenant.local` | BD |
| Presales Manager | `presales.manager@sample-tenant.local` | presales mgmt |
| Presales Executive | `presales.executive@sample-tenant.local` | presales |
| Support Manager | `support.manager@sample-tenant.local` | support mgmt |
| Support Executive | `support.executive@sample-tenant.local` | ≈22 |
| Partner Manager | `partner.manager@sample-tenant.local` | partners |
| Reseller Manager | `reseller.manager@sample-tenant.local` | resellers |
| Customer Success Manager - Onboarding | `customer.success.manager.onboarding@sample-tenant.local` | CS onboarding |
| Customer Success Manager - Scaled | `customer.success.manager.scaled@sample-tenant.local` | CS scaled |
| Customer Success Manager - Enterprise | `customer.success.manager.enterprise@sample-tenant.local` | CS enterprise |
| Customer Success Head | `customer.success.head@sample-tenant.local` | CS leadership |
| Executive Leadership | `executive.leadership@sample-tenant.local` | exec dashboards |
| Customer Portal User | `customer.portal.user@sample-tenant.local` | ≈4 (external portal) |

## What to look for (RBAC in action)

- The **left navigation adapts** to each role — modules a role can't access don't appear.
- Actions you lack are denied with **403 / Unauthorized** (or the button is hidden).
- **Super Admin** sees everything; **Support Executive** sees support; **Customer Portal User** only sees the external portal (`/portal/*`).
- The **Customer Portal User** is linked to an active portal profile (a seeded account), so the portal is usable end-to-end.

> These are demo accounts with a shared, well-known password. Do **not** seed them in any production tenant.
