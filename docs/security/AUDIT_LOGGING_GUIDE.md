# Audit Logging Guide

## Purpose

This guide explains the current audit logging behavior implemented in the Phase 2, Phase 3, and Phase 4 foundation.

## Storage Model

Audit entries are stored in `audit_logs`.

Key fields:
- `tenant_id`
- `actor_user_id`
- `session_id`
- `event_type`
- `action`
- `resource_type`
- `resource_id`
- `status`
- `ip_address`
- `user_agent`
- `request_id`
- `metadata`
- `created_at`

`audit_logs` is append-only and intentionally does not support soft delete.

## Events Logged Today

The platform currently records:
- successful login
- failed login
- denied login for disabled or locked users
- successful refresh token rotation
- failed refresh token usage when a session is known
- logout
- role creation
- role updates
- role deletion
- role-permission replacement
- user-role replacement

## Event Shape

Typical values include:
- `event_type = 'auth'`
- `action = 'auth.login' | 'auth.refresh' | 'auth.logout'`
- `resource_type = 'session'`
- `status = 'success' | 'failure' | 'denied'`

RBAC events now also include examples such as:
- `event_type = 'rbac'`
- `action = 'rbac.role.create' | 'rbac.role.update' | 'rbac.role.delete'`
- `action = 'rbac.role.permissions.replace' | 'rbac.user.roles.replace'`
- `resource_type = 'role' | 'user'`

The `metadata` payload captures contextual details such as:
- tenant slug used at login
- normalized email
- failure reason
- failed login count where relevant

## Operational Guidance

Use audit logs to answer questions such as:
- which tenant had repeated failed logins?
- which user last rotated a session?
- which session was revoked and why?
- what request id corresponds to a suspicious auth event?

## Current Boundaries

What is covered now:
- authentication lifecycle events
- RBAC administration events
- request-level identifiers for auth flows
- tenant and actor correlation when available

What is not covered yet:
- business object CRUD auditing
- field-level before/after diffs
- export/download audit trails
- AI action audit trails

## Recommended Query Patterns

Common filters:
- by `tenant_id` and recent `created_at`
- by `actor_user_id`
- by `session_id`
- by `status = 'failure'`

## Future Expansion

Later phases should extend audit coverage to:
- user creation and deactivation
- tenant configuration changes
- data exports
- AI governance and tool execution
