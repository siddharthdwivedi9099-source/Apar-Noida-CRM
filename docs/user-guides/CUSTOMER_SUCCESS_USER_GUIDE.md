# Customer Success User Guide

## Purpose

This guide explains how customer success managers use the Customer Success workspace introduced in Phase 16.

## Accessing the workspace

Open **Customer Success** from the navigation. The module appears for roles with Customer Success access (the seeded onboarding, scaled, enterprise CSM roles and the Customer Success Head) and when the tenant has the Customer Success module enabled.

## Dashboard

The top of the workspace shows portfolio metrics for your visibility scope: total CS accounts, at-risk accounts, renewals due, average health and adoption scores, open escalations, and total contract value.

## Workspace tabs

Switch between the **Onboarding**, **Scaled**, and **Enterprise** workspaces. Each tab shows segment-specific metrics and the accounts in that segment.

## Adding a customer success account

1. Click **Add CS account** (requires create permission).
2. Choose the CRM account, assign a CSM owner, and set segment, lifecycle stage, risk status, and contract value.
3. Submit; the new account opens in the detail panel.

## Working an account

The detail panel shows the account profile (health, adoption, owner, contract value, expansion potential, next action) and child collections:
- **Onboarding plans** with milestone progress
- **Health scores** history (use **Record health** to add a score)
- **Renewals** (use **Add renewal** to schedule one)
- **QBR / EBR** sessions
- **Escalations** (risk register)
- **Success plans** with stakeholder counts
- Permission-aware AI placeholders

## Dashboards

The customer health dashboard and renewal dashboard are available through the API (`/customer-success/dashboards/health` and `/customer-success/dashboards/renewal`) and feed the workspace metrics.

## Permission behavior

- Users without Customer Success access do not see the module in navigation.
- Users without create permission cannot add accounts.
- Users without edit permission cannot record health, add renewals, or update child records.
- Users without assign permission cannot reassign the CSM owner.

## Current limits

- Low-touch campaigns and automated check-ins are placeholders.
- AI placeholder actions are visible but deferred until the AI Gateway phase.
- Health scores are entered by CSMs; automated scoring is a future enhancement.

## Customer success dashboards (Phase 23)

The **Analytics** page (`/analytics`) includes dashboards built for customer success:

- **Customer success dashboard** — health distribution, at-risk customer count, average adoption score, the renewal timeline (next six months), and training completion.
- **Customer health dashboard** — health distribution, at-risk count, adoption score, and a customer-risk table of the lowest-health accounts (with drill-down to the full list).
- **Onboarding dashboard** — onboarding plans by status and training completion.

All figures come from live customer success, renewal, onboarding, and training records, respect date filters where applicable, and can be saved as views or exported (with export permission). The AI insights dashboard additionally surfaces customer risk and recommended actions.
