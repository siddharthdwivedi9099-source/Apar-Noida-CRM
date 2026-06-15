# RBAC Matrix

## Purpose

This document describes the implemented Phase 4 role-based access-control baseline for the platform.

It should be read together with:
- [ACCESS_CONTROL_GUIDE.md](./ACCESS_CONTROL_GUIDE.md)
- [ADMIN_GUIDE.md](../user-guides/ADMIN_GUIDE.md)
- [ROLE_CATALOG.md](../business/ROLE_CATALOG.md)

## Implemented Permission Model

RBAC is now implemented with:
- tenant-scoped `roles`
- global `permissions`
- tenant-scoped `role_permissions`
- tenant-scoped `user_roles`
- global `role_templates`
- global `role_template_permissions`
- API permission middleware
- permission-aware frontend navigation and route guards

## Permission Modules

The seeded permission catalog covers:
- `leads`
- `accounts`
- `contacts`
- `opportunities`
- `campaigns`
- `social`
- `marketing`
- `sales`
- `presales`
- `partners`
- `resellers`
- `support`
- `customer_success`
- `training`
- `customer_query`
- `dashboards`
- `workflows`
- `ai`
- `admin`

## Permission Categories

The seeded action categories are:
- `view`
- `create`
- `edit`
- `delete`
- `assign`
- `approve`
- `export`
- `import`
- `configure`
- `use_ai`
- `manage_ai`
- `view_dashboard`
- `manage_workflow`

## Action Profiles

The seeded role templates use four broad action profiles:

| Profile | Intended Use | Typical Actions |
| --- | --- | --- |
| `admin` | tenant administration and governance | all actions across `admin`, plus broad module coverage |
| `manager` | operational leadership inside a function | `view`, `create`, `edit`, `delete`, `assign`, `approve`, `export`, `import`, `configure`, plus dashboard and workflow actions |
| `contributor` | day-to-day execution inside a function | `view`, `create`, `edit`, `export`, plus dashboard visibility and AI use where relevant |
| `leadership` | executive or head-level oversight | `view`, `approve`, `export`, `configure`, plus dashboard visibility and selected workflow or AI governance access |

## Seeded Role Template Matrix

| Role Template | Profile | Primary Module Coverage |
| --- | --- | --- |
| `Super Admin` | `admin` | all modules and all permission categories |
| `CRM Admin` | `admin` | all tenant modules, admin governance, AI governance, workflow controls |
| `Social Media Marketing Executive` | `contributor` | `social`, `campaigns`, `marketing`, `dashboards`, `ai` |
| `Social Media Marketing Manager` | `manager` | `social`, `campaigns`, `marketing`, `dashboards`, `workflows`, `ai` |
| `Marketing Executive` | `contributor` | `marketing`, `campaigns`, `dashboards`, `ai` |
| `Marketing Manager` | `manager` | `marketing`, `campaigns`, `dashboards`, `workflows`, `ai` |
| `Inside Sales Executive` | `contributor` | `leads`, `contacts`, `opportunities`, `sales`, `dashboards`, `ai` |
| `Inside Sales Manager` | `manager` | `leads`, `contacts`, `opportunities`, `sales`, `dashboards`, `workflows`, `ai` |
| `Sales Development Representative` | `contributor` | `leads`, `contacts`, `opportunities`, `dashboards`, `ai` |
| `SDR Manager` | `manager` | `leads`, `contacts`, `opportunities`, `dashboards`, `workflows`, `ai` |
| `Business Development Executive` | `contributor` | `leads`, `accounts`, `contacts`, `opportunities`, `partners`, `resellers`, `dashboards`, `ai` |
| `Business Development Manager` | `manager` | `leads`, `accounts`, `contacts`, `opportunities`, `partners`, `resellers`, `dashboards`, `workflows`, `ai` |
| `Sales Executive` | `contributor` | `sales`, `accounts`, `contacts`, `opportunities`, `dashboards`, `ai` |
| `Sales Manager` | `manager` | `sales`, `accounts`, `contacts`, `opportunities`, `leads`, `dashboards`, `workflows`, `ai` |
| `Sales Head` | `leadership` | `sales`, `accounts`, `contacts`, `opportunities`, `leads`, `marketing`, `dashboards`, `workflows`, `ai` |
| `Sales Leader` | `leadership` | `sales`, `accounts`, `contacts`, `opportunities`, `leads`, `dashboards`, `workflows`, `ai` |
| `Presales Executive` | `contributor` | `presales`, `accounts`, `contacts`, `opportunities`, `dashboards`, `ai` |
| `Presales Manager` | `manager` | `presales`, `accounts`, `contacts`, `opportunities`, `dashboards`, `workflows`, `ai` |
| `Support Executive` | `contributor` | `support`, `customer_query`, `accounts`, `contacts`, `dashboards`, `ai` |
| `Support Manager` | `manager` | `support`, `customer_query`, `accounts`, `contacts`, `customer_success`, `dashboards`, `workflows`, `ai` |
| `Partner Manager` | `manager` | `partners`, `accounts`, `opportunities`, `dashboards`, `ai` |
| `Reseller Manager` | `manager` | `resellers`, `accounts`, `opportunities`, `dashboards`, `ai` |
| `Customer Success Manager - Onboarding` | `manager` | `customer_success`, `training`, `support`, `accounts`, `contacts`, `dashboards`, `workflows`, `ai` |
| `Customer Success Manager - Scaled` | `manager` | `customer_success`, `training`, `customer_query`, `accounts`, `dashboards`, `workflows`, `ai` |
| `Customer Success Manager - Enterprise` | `manager` | `customer_success`, `support`, `training`, `accounts`, `contacts`, `dashboards`, `workflows`, `ai` |
| `Customer Success Head` | `leadership` | `customer_success`, `support`, `training`, `customer_query`, `accounts`, `contacts`, `dashboards`, `workflows`, `ai` |
| `Executive Leadership` | `leadership` | `dashboards`, `sales`, `marketing`, `customer_success`, `support`, `accounts`, `opportunities`, `ai`, `admin` |

## Enforcement Notes

Current enforcement in code:
- admin RBAC APIs require `admin.*` permissions
- frontend navigation hides modules when the current user lacks matching module permissions
- protected module routes render an access-denied state when manually visited without permission
- `/auth/me` returns resolved role and permission data for the active user

Not yet implemented:
- record-level ownership checks
- field-level redaction
- approval-chain conditions beyond permission membership
- business-domain CRUD APIs for every module in this matrix

## Review Guidance

Revisit this matrix when:
- a new business module is added
- a role template needs broader or narrower module ownership
- AI features move from visibility to real execution
- record-level authorization is introduced
