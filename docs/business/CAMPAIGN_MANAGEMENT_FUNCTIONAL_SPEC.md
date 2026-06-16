# Campaign Management Functional Specification

## Purpose

This document describes the implemented Phase 8 campaign management foundation.

## Implemented Scope

The current campaign module supports:
- campaign list
- campaign detail
- campaign create
- campaign edit
- campaign soft delete
- campaign type
- campaign objective
- campaign target audience
- campaign budget
- campaign owner
- campaign status
- campaign start date
- campaign end date
- campaign channel
- related asset references
- campaign members
- campaign tasks through shared productivity
- campaign performance placeholder
- campaign calendar placeholder
- permission-aware AI placeholders

## Campaign Types

Seeded campaign types now include:
- Email campaign
- Social campaign
- WhatsApp campaign
- SMS campaign
- Event campaign
- Webinar campaign
- Lead generation campaign
- Product launch campaign
- Partner campaign
- Reseller campaign
- Customer retention campaign
- Adoption campaign
- Renewal campaign

## Campaign Members

Campaign members can be attached as:
- leads
- contacts
- accounts

Each member currently supports:
- membership status
- free-form response tracking
- conversion placeholder messaging

Membership writes are tenant-scoped, audit logged, soft-delete-aware, and re-addable after removal.

## Frontend Behavior

The shipped frontend now includes:
- campaign dashboard placeholder on the list page
- campaign list with search, filters, sorting, pagination, and soft delete
- campaign detail page with strategy summary, assets, members, notes, activities, tasks, and timeline
- campaign create and edit form
- campaign member management UI
- campaign calendar placeholder surface
- AI placeholder actions that appear only when the current role includes campaign or global AI usage permissions

## Backend Behavior

The shipped backend now includes:
- tenant-scoped `campaigns` table
- tenant-scoped `campaign_members` table
- campaign CRUD APIs
- campaign member CRUD APIs
- campaign options API
- campaign support in shared notes, activities, tasks, and timeline routes
- audit logging for campaign and campaign-member writes

## Permissions

Campaign APIs and frontend actions depend on the existing RBAC model:
- `campaigns.view` and related read permissions open the module
- `campaigns.create` or `campaigns.configure` allow creation
- `campaigns.edit`, `campaigns.assign`, or `campaigns.configure` allow updates
- `campaigns.delete` or `campaigns.configure` allow soft delete
- `campaigns.assign` supports assign-only mutations for owner and member-status style updates
- `campaigns.use_ai`, `campaigns.manage_ai`, `ai.use_ai`, or `ai.manage_ai` surface AI placeholders

## Current Limits

Not implemented yet:
- true attribution and conversion analytics
- real campaign performance metrics
- real calendar and scheduling workflows
- AI execution through the AI Gateway
- opportunity conversion from campaign members
