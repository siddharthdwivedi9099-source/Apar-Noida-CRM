# Workflow Automation Engine

## Purpose

The workflow engine (Phase 24 and Phase 25) lets administrators automate business processes from configurable triggers, conditions, and actions. Every run is logged for traceability, actions respect permissions, AI actions route through the AI Gateway, and Phase 25 turns notifications and approvals into persisted workflow outcomes.

## Components

- **Workflow** — a definition with a single trigger, optional conditions, and an ordered list of actions. Has a `status` (`draft`/`active`/`inactive`) and an `is_enabled` flag; only active, enabled workflows can run.
- **Trigger** — what starts the workflow. One of fourteen trigger types (see below).
- **Condition** — a `{ field, operator, value }` test evaluated (AND) against the trigger context. Operators: `eq`, `ne`, `gt`, `lt`, `gte`, `lte`, `contains`, `exists`, `in`.
- **Action** — an ordered step the workflow performs. One of fourteen action types. Each action carries an `action_config` and an optional `requires_permission` (defaulted from the action catalog).
- **Workflow run** — one execution (`workflow_runs`): status (`running`/`succeeded`/`failed`/`skipped`), trigger context, action counts, error message, timing.
- **Workflow log** — per-step records (`workflow_logs`): one row per action (or the condition gate) with `succeeded`/`failed`/`skipped`, a message, and a JSON detail.
- **Notification delivery** — Phase 25 introduces tenant-scoped `notifications` plus per-user `notification_deliveries` and `notification_preferences`, so workflow notifications create durable in-app inbox items with read/unread state and role-based fan-out.
- **Approval workflow** — Phase 25 introduces tenant-scoped `approval_requests` and append-only `approval_history`, so workflow approvals create governed approval requests with approvers, comments, and decision history.

## Triggers

`record_created`, `record_updated`, `stage_changed`, `assignment_changed`, `date_reached`, `sla_breached`, `campaign_response_received`, `ticket_escalated`, `ai_score_changed`, `customer_health_changed`, `onboarding_delayed`, `training_incomplete`, `renewal_approaching`, `usage_dropped`.

## Actions

`assign_owner`, `create_task`, `send_notification`, `send_email` (deferred), `update_field`, `change_status`, `trigger_approval`, `call_webhook` (deferred), `run_ai_prompt`, `run_ai_agent`, `create_support_ticket`, `assign_training`, `create_customer_success_task`, `trigger_renewal_playbook`.

Behavior in the current repository:
- `send_notification` creates persisted in-app notifications with linked-record context, read/unread tracking, and role-based delivery fan-out.
- `trigger_approval` creates persisted approval requests with approver routing and approval history.
- `run_ai_prompt` and `run_ai_agent` execute through the AI Gateway and record provider, model, and output.
- Remaining non-AI actions are still governed, logged effects.

## Execution model

1. A run is started against an active workflow with a trigger context (manually via `POST /workflows/:id/run`, or by an external caller passing the event payload).
2. Conditions are evaluated against the context. If any fails, the run is recorded as `skipped` with a log entry — fully traceable.
3. Otherwise each enabled action runs in sequence:
   - **Permission check (Rule 1)** — if the action's `requires_permission` is set and the running actor lacks it, the action is logged `failed` with the missing permission and the run continues.
   - **Persisted delivery (Phase 25)** — `send_notification` writes `notifications` + `notification_deliveries`; `trigger_approval` writes `approval_requests` + `approval_history` and also generates approver notifications.
   - **AI Gateway (Rule 4)** — `run_ai_prompt`/`run_ai_agent` call the AI Gateway; failures (e.g. AI disabled) are caught and logged `failed`.
   - Each action writes a `workflow_logs` row.
4. The run is finalized: `succeeded` if no action failed, else `failed` with an error message and per-action failure logs (Rules 2 and 3 — runs are logged and failures are traceable).

## Permissions

- Read/catalog: any `workflows.*`.
- Create: `workflows.create`/`workflows.configure`/`workflows.manage_workflow`.
- Edit (workflow + actions): `workflows.edit`/`workflows.configure`/`workflows.manage_workflow`.
- Run: `workflows.manage_workflow`/`workflows.configure`/`workflows.edit`.
- Action execution additionally checks each action's `requires_permission` against the running actor.
- Notification center visibility and read state use `notifications.*` permissions.
- Approval inbox visibility and decisioning use `approvals.*` permissions, and the assigned approver (user or role) must also match unless an admin/configure permission overrides it.

## API

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md#workflow-automation-routes-phase-24).
