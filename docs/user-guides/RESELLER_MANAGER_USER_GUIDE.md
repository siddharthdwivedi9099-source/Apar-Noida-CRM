# Reseller Manager User Guide

## Purpose

This guide explains how reseller managers use the Reseller workspace introduced in Phase 14.

## Accessing the workspace

Open **Resellers** from the navigation. The module appears for roles with Resellers access (for example the seeded Reseller Manager role) and when the tenant has the Resellers module enabled.

## Reseller dashboard

The top of the workspace shows channel metrics for your visibility scope:
- Total resellers and active resellers
- Onboarding in progress
- Registered deal count and registered deal value
- Won deals, average margin, and your current scope (mine / team / all)

## Reseller list

The reseller list shows each reseller's pricing tier, status, margin, region/territory, owner, onboarding progress, and deal count. Select a reseller to open its detail panel.

## Creating a reseller

1. Click **Add reseller** (requires create permission).
2. Enter the reseller name and choose status, pricing tier, and margin profile.
3. Optionally set a margin percent, link a CRM account, assign an owner, and set region, territory, and an agreement reference.
4. Optionally add onboarding checklist tasks, one per line.
5. Submit to create the reseller; the new record opens automatically.

## Reseller detail, onboarding, and deals

The detail panel shows:
- Profile, owner, margin, linked account, and agreement reference
- Reseller contacts (primary contact highlighted)
- **Onboarding checklist** — use **Advance** to move a task through pending → in progress → completed
- **Registered deals** — review stage, customer, amount, and per-deal margin
- Register a new deal with the inline form (name, stage, customer, amount, margin, optional linked opportunity)
- Permission-aware AI placeholders (performance insight, sales prediction, margin optimization, opportunity recommendation, inactivity alert, coaching recommendation)

## Permission behavior

- Users without Resellers access do not see the module in navigation.
- Users without create permission cannot open the create form.
- Users without edit permission cannot advance onboarding tasks or register deals.
- Users without assign permission cannot reassign reseller ownership.

## Current limits

- Catalog, order tracking, training linkage, and certification are placeholders.
- AI placeholder actions are visible but deferred until the AI Gateway phase.
- There is no external reseller portal in this phase.
