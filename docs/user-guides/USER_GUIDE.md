# User Guide

## Purpose

This guide explains how end users work with the shared activities, tasks, notes, customer timeline, notifications, and approvals features currently available in the platform.

## Where These Features Appear

You can use the shared productivity workspace from:
- lead detail pages
- account detail pages
- contact detail pages

Each detail page now includes:
- a notes panel
- an activities panel
- a task list
- a customer timeline

## Notes

Use notes when you need to capture context that should stay attached to the record.

Supported behavior:
- add an internal note
- mark a note as customer-facing
- edit an existing note
- review author and timestamp information

Use customer-facing notes for information that can safely be surfaced in downstream customer workflows later.

## Activities

Use activities to log touchpoints that happened around the record.

Supported activity types:
- call
- email
- meeting
- chat
- social
- demo
- training
- support
- renewal

For each activity, you can capture:
- owner
- occurred date and time
- subject
- outcome
- notes

## Tasks

Use tasks to assign follow-up work directly from the record.

Supported task fields:
- title
- description
- owner
- assignee
- due date
- reminder placeholder
- priority
- status

Users with the right permissions can:
- create tasks
- reassign tasks
- update task status
- adjust due dates and priority

## Customer Timeline

The customer timeline gives a chronological view of related touchpoints on the current record.

Timeline behavior:
- newest items appear first
- notes, activities, and tasks appear together
- filters let you focus on a single touchpoint type

Use the timeline when you need quick history before contacting the customer or handing work to another teammate.

## Permissions

What you can do depends on your role.

Typical behavior:
- users without module access cannot open the module
- users with read access can review notes, activities, tasks, and timeline items
- users with create, edit, assign, or configure permissions can add or update shared productivity records

If an action is unavailable, contact your administrator to review your role permissions.

## Analytics dashboards (Phase 23)

The **Analytics** page (`/analytics`) gives you role-based dashboards built from live CRM data.

- **Pick a dashboard** — the sidebar lists every dashboard; those your role can't open are dimmed. Choose from executive, sales, marketing, campaign, social, SDR, inside sales, presales, partner, reseller, support, customer success, onboarding, customer health, training, revenue, forecast, and AI insights.
- **Widgets** — each dashboard shows metrics, charts, funnels, timelines, and tables computed from real records.
- **Date filters** — set a **From**/**To** range and click **Apply** to scope the data; **Clear** resets it.
- **Drill-down** — widgets that support it have a **Drill down** button that lists the underlying records (for example the leads or tickets behind a number).
- **Saved views** — name and **Save** the current filter as a view, then re-apply it later; shared views are visible to your team.
- **Export** — use **Export** to download the dashboard data (requires export permission).

## Notifications and Approvals (Phase 25)

The platform now includes:
- a **Notification center** at `/notifications`
- an **Approval inbox** at `/approvals`

### Notification center

Use the notification center when you need a tenant-scoped view of in-app alerts.

Available behavior:
- review unread and read notifications
- filter by notification type
- inspect linked-record context
- mark one notification or all visible notifications as read
- manage in-app notification preferences by type

Role-based notifications can be delivered to an individual user or fan out to everyone currently assigned to a role.

### Approval inbox

Use the approval inbox when you need to review governed business requests such as:
- discount approval
- campaign approval
- proposal approval
- partner approval
- reseller approval
- sensitive AI action approval
- customer escalation approval

Available behavior:
- review requests assigned to you or your role
- inspect approval history
- add comments to the approval history
- approve or reject pending requests when you have approval rights

### Permission expectations

Typical behavior:
- `notifications.view` or `notifications.edit` opens the notification center
- `approvals.view` opens the approval inbox
- `approvals.approve` is required to decide a pending request
- administrators can still override with broader configuration permissions when appropriate
