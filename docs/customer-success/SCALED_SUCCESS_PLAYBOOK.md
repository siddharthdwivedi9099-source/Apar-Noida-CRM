# Scaled Customer Success Playbook

## Purpose

This playbook guides the Customer Success Manager – Scaled through the scaled/digital motion implemented in Phase 16.

## Scope

Scaled accounts are customer success accounts in the `scaled` segment. The scaled workspace (`GET /customer-success/workspaces/scaled`) surfaces the portfolio, healthy and at-risk counts, renewals due within 90 days, average health, and the segment distribution.

## Motion

1. **Manage the portfolio** as a list rather than per-account deep engagement; use health and adoption scores to prioritize.
2. **Monitor health and adoption** with periodic health-score records and adoption metrics (`POST .../adoption-metrics`).
3. **Surface at-risk customers** (risk status at-risk or critical) and intervene.
4. **Drive renewal readiness** by tracking renewals (`POST .../renewals`) and watching the renewal dashboard.
5. **Segment customers** for targeted plays.

## Placeholders

- **Low-touch campaigns** — deferred until the lifecycle automation runtime is introduced.
- **Automated check-ins** — deferred until the lifecycle automation runtime is introduced.

## Signals to watch

- Declining support trend
- Health or adoption score drops
- Renewals due soon without an owner or strategy

## AI placeholders

Customer health summary, churn risk prediction, adoption recommendation, and customer success email draft placeholders are available to roles with AI usage permission.
