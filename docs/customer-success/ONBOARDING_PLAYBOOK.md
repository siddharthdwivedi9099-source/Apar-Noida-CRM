# Customer Success Onboarding Playbook

## Purpose

This playbook guides the Customer Success Manager – Onboarding through the onboarding motion implemented in Phase 16.

## Scope

Onboarding accounts are customer success accounts in the `onboarding` segment. The onboarding workspace (`GET /customer-success/workspaces/onboarding`) surfaces new customers, in-onboarding accounts, training completion, and at-risk accounts.

## Motion

1. **Create the CS account** with segment `onboarding` and the `onboarding` lifecycle stage, assigning a CSM owner.
2. **Build the onboarding plan** (`PUT /customer-success/accounts/:id/onboarding-plan`) with a target go-live date, product activation status, training completion, risk notes, and handover notes.
3. **Track milestones** as an ordered checklist (pending, in progress, completed, blocked) within the plan.
4. **Capture first value** via the plan's first-value timestamp and product activation status.
5. **Record health** as onboarding progresses so risk surfaces early.
6. **Hand over** to the scaled or enterprise motion by updating the segment and lifecycle stage and completing the handover notes.

## Signals to watch

- Stalled milestones or blocked status
- Training completion below target
- Product activation not started near go-live
- Risk status moving to at-risk or critical

## AI placeholders

The onboarding plan generator and customer health summary placeholders are available to roles with AI usage permission and will connect to the AI Gateway in a later phase.
