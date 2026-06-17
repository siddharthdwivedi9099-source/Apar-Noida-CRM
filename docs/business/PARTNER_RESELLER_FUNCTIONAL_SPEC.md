# Partner and Reseller Functional Specification

## Purpose

This document describes the partner channel management capabilities delivered in Phase 13. It covers partner profiles, partner operations, deal registration, and the partner performance dashboard for channel and reseller motions.

## Scope

Phase 13 introduces a tenant-aware partner channel module backed by the `partners`, `partner_contacts`, `partner_onboarding_tasks`, and `partner_deal_registrations` tables. Access is governed by the existing `partners.*` permission set and tenant module switches.

## Partner Profile

Each partner record captures:
- Partner name
- Partner type (reseller, referral, system integrator, technology, distributor)
- Partner tier (registered, silver, gold, platinum)
- Region and territory
- Status (prospect, active, suspended, terminated)
- Agreement details (reference, start date, end date, notes)
- Partner contacts (with optional links to CRM contacts and a primary flag)
- Partner owner
- Onboarding status (not started, in progress, completed)

## Partner Operations

- Partner onboarding checklist: ordered tasks with status (pending, in progress, completed, blocked), due dates, and notes.
- Partner lead tracking: deal registrations may reference an originating lead.
- Partner opportunity tracking: deal registrations may link to an opportunity.
- Deal registration: partner-sourced deals with stage (registered, approved, in progress, won, lost, rejected), customer name, amount, and expected close date.
- Partner enablement assets: placeholder for a future collateral library.
- Partner training linkage: placeholder for a future training and certification module.
- Partner support tickets linkage: placeholder pending the support module.
- Partner performance dashboard: active partners, onboarding-in-progress, registered and won deals, registered deal value, and tier distribution.

## AI Placeholders

Permission-aware, deferred until the AI Gateway phase:
- Partner fit score
- Partner performance summary
- Partner action plan
- Partner churn risk
- Partner conflict detection

## Permissions and Visibility

- All partner routes require one of the `partners.*` permissions.
- Visibility follows owner/team/all scoping; roles without shared-scope permissions see only owned partners.
- Ownership reassignment requires `partners.assign` or `partners.configure`.
- Deal registration requires `partners.create`, `partners.edit`, or `partners.configure`.

## Out of Scope (Phase 13)

- Partner portal / external partner login
- Automated deal-registration approval workflows
- Live enablement asset library, training linkage, and support ticket linkage (placeholders only)
- AI execution for the partner AI placeholders

## Reseller Management (Phase 14)

Phase 14 introduces a tenant-aware reseller module backed by the `resellers`, `reseller_contacts`, `reseller_onboarding_tasks`, and `reseller_deal_registrations` tables, governed by the `resellers.*` permission set.

### Reseller Profile

- Reseller name
- Region and territory
- Status (prospect, active, suspended, terminated)
- Owner
- Pricing tier (standard, preferred, premier, strategic)
- Margin profile (standard, volume, strategic, custom) plus a numeric margin percent
- Agreement details (reference, start date, end date, notes)
- Reseller contacts (with optional links to CRM contacts and a primary flag)

### Reseller Operations

- Reseller onboarding: ordered checklist tasks with status, due dates, and notes, plus an onboarding status.
- Reseller catalog: placeholder for a future product and pricing catalog.
- Reseller lead tracking: deal registrations may reference an originating lead.
- Reseller deal registration: reseller-sourced deals with stage (registered, approved, ordered, won, lost, rejected), customer name, amount, and per-deal margin percent.
- Reseller order tracking: placeholder for a future order management runtime.
- Reseller training linkage: placeholder for the training module.
- Reseller certification: placeholder for the certification module.
- Reseller support tickets linkage: placeholder pending the support module.
- Reseller performance dashboard: active resellers, onboarding-in-progress, registered and won deals, registered value, average margin, and pricing-tier distribution.

### AI Placeholders

Permission-aware, deferred until the AI Gateway phase:
- Reseller performance insight
- Reseller sales prediction
- Margin optimization
- Reseller opportunity recommendation
- Inactivity alert
- Reseller coaching recommendation

### Out of Scope (Phase 14)

- Reseller portal / external reseller login
- Live catalog, order tracking, training, and certification (placeholders only)
- AI execution for the reseller AI placeholders
