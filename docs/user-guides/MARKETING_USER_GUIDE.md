# Marketing User Guide

## Purpose

This guide explains how marketing users work with the Phase 8 campaign management foundation.

## Where to Work

Use the campaign module from:
- `/campaigns`
- `/campaigns/new`
- `/campaigns/:campaignId`
- `/campaigns/:campaignId/edit`

## Campaign List

The campaign list page now supports:
- search by campaign name, description, or target audience
- filters for status, type, channel, and owner
- sorting
- pagination
- dashboard placeholder metrics
- campaign calendar placeholder

Use the list page when you need to:
- find an existing campaign quickly
- review status and budget across active work
- open campaign detail
- soft delete a campaign if your role allows it

## Creating and Editing Campaigns

The campaign form captures:
- campaign name
- description
- type
- objective
- target audience
- budget
- owner
- status
- start date
- end date
- channel
- related asset links

Dropdown values come from tenant configuration, so your administrator can change the available campaign vocabulary later without a schema rewrite.

## Managing Campaign Members

From campaign detail, you can:
- add a lead to a campaign
- add a contact to a campaign
- add an account to a campaign
- update member status
- update member response
- remove a member from the campaign

Current member tracking includes:
- membership status
- response notes
- conversion placeholder messaging

## Shared Productivity on Campaigns

Campaign detail now includes:
- notes
- activities
- tasks
- timeline

Use these areas to:
- capture internal or customer-facing context
- log outreach and touchpoints
- assign follow-up work
- review campaign history in one place

## AI Placeholders

Campaign detail can show:
- AI campaign plan generator
- AI content generator
- AI audience suggestion

These are placeholders only in Phase 8. If you do not see them, your role probably lacks campaign or AI usage permissions.

## Permissions

Typical behavior:
- users with read access can review campaigns and related productivity history
- users with create or configure access can create campaigns
- users with edit, assign, or configure access can update campaigns and members
- users with delete or configure access can soft delete campaigns

If an action is unavailable, ask your administrator to review your assigned roles and permissions.
