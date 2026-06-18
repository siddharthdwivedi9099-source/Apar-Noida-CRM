# Customer Health Score Design

## Purpose

This document defines the design direction for customer health scoring so future health indicators remain transparent, explainable, and operationally useful.

## Scope

This document covers:
- health score objectives
- design principles
- candidate input dimensions
- governance expectations
- implementation guidance

This document does not cover:
- final formulas
- production alert thresholds
- statistical model implementation

## Objectives

- surface customer risk and opportunity earlier
- help success teams prioritize action
- provide executive visibility into portfolio trends
- connect multiple operational signals into a usable view

## Design Principles

### Explainability

Users should be able to understand why a score changed.

### Auditability

Inputs, overrides, and generated scores should be reviewable historically.

### Governance

Score definitions should be configurable under control, not changed informally.

### Balance

Health should reflect both risk and positive adoption signals.

## Candidate Health Dimensions

- product adoption
- support burden
- onboarding progress
- training completion
- stakeholder engagement
- renewal timeline
- expansion interest
- customer sentiment

## Data Source Expectations

- account activity
- ticket volumes and severity
- milestone completion
- training participation
- meeting and task follow-through
- survey or feedback indicators

## Operational Use Cases

- weekly risk review
- renewal prioritization
- escalation triggers
- executive portfolio review
- AI-assisted next-best-action suggestions in the future

## Governance Expectations

- tenant-specific weighting may be supported, but changes should be versioned
- manual overrides should be restricted and logged
- score history should be retained for trend analysis

## Implementation Guidance

When implementation begins:
- start with a simple weighted model before attempting advanced prediction
- expose contributing signals alongside the score
- define thresholds and alert behavior explicitly
- avoid black-box scoring that customer-facing teams cannot trust
- connect health state changes to workflow and reporting expectations

## Phase 16 Implementation

Health scoring fields are implemented in Phase 16:

- `customer_success_accounts.health_score` and `adoption_score` hold the current 0–100 scores, with `risk_status_option_id` (`cs-risk-status`: healthy, watch, at risk, critical) and `support_trend` (improving, stable, declining).
- `customer_health_scores` stores the scoring history (`score`, optional risk status, `drivers`, `notes`, `recorded_at`). Recording a score updates the account's denormalized `health_score` (and risk status when supplied) so dashboards stay current.
- The customer health dashboard (`GET /customer-success/dashboards/health`) reports average health and adoption, healthy/watch/at-risk/critical counts, declining-support count, and the risk distribution.

Scoring weights and automated computation remain a future enhancement; Phase 16 captures explicit, explainable scores entered by CSMs and exposes the history and drivers for transparency.
