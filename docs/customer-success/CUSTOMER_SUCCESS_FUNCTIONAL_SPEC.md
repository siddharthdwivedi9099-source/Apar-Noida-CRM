# Customer Success Functional Specification

## Purpose

This document defines the future customer success capabilities of the platform, with a focus on adoption planning, risk management, renewals, and coordinated customer outcomes.

## Scope

This document covers:
- customer success use cases
- primary actors
- core objects and workflows
- reporting expectations
- implementation guidance

This document does not cover:
- UI layouts
- automated scoring formulas
- workflow engine implementation

## Objectives

- provide structured success planning
- surface customer risk and opportunity signals
- connect post-sales work to support, onboarding, and training context
- improve renewal and adoption management

## Primary Actors

- Customer Success Manager
- Support Manager
- Account Executive
- Onboarding Specialist
- Executive Viewer

## Core Capabilities

### Success Plan Management

- create and maintain success plans
- associate goals, milestones, and owners
- track progress against customer objectives

### Risk Management

- capture risk records with severity, owner, and mitigation
- support structured review of open risks
- connect risks to support, onboarding, training, or relationship signals

### Stakeholder and Relationship Context

- maintain visibility into key customer stakeholders
- record relationship notes and engagement history
- help teams understand who influences adoption or renewals

### Renewal and Expansion Readiness

- surface renewal timing and related action plans
- expose potential expansion signals to the right teams
- preserve coordination with account teams without collapsing success into sales workflows

## Required Objects

- success plan
- customer objective
- milestone
- risk record
- stakeholder profile
- action item
- renewal record
- health score snapshot

## Workflow Expectations

- every success plan should align to an account and lifecycle stage
- risks should have structured ownership and review cadence
- action items should be assignable and traceable
- cross-functional handoffs from onboarding or support should preserve context

## Reporting Expectations

- portfolio health overview
- open risk visibility
- renewal readiness view
- adoption milestone tracking
- action completion status

## Implementation Guidance

When implementation begins:
- ensure success plans reuse shared account, contact, activity, and ticket context
- separate success planning from generic note-taking
- make health and risk reasoning explainable
- support executive read visibility without broad edit rights
- connect success outputs to dashboards and future workflow automation

## Phase 16 Implementation

The customer success core module is implemented in Phase 16, backed by nine tenant-scoped tables (`customer_success_accounts`, `onboarding_plans`, `onboarding_milestones`, `success_plans`, `customer_health_scores`, `adoption_metrics`, `qbrs`, `renewals`, `escalations`) and governed by the `customer_success.*` permission set.

### Roles supported

- Customer Success Manager – Onboarding
- Customer Success Manager – Scaled
- Customer Success Manager – Enterprise
- Customer Success Head

### Customer success account

Each account carries an account link, CSM owner, segment, lifecycle stage, health score, adoption score, renewal date, contract value, risk status, expansion potential, support trend, training status, last touchpoint, and next action.

### Workspaces

- **Onboarding** — new customers, onboarding plan and milestone checklist, training and product activation status, first-value tracking, risk capture, and handover notes.
- **Scaled** — portfolio view, health and adoption trends, at-risk customers, renewal readiness, customer segments, plus low-touch campaign and automated check-in placeholders.
- **Enterprise** — strategic success plan, stakeholder map, QBR/EBR tracker, executive relationship tracking, value realization, enterprise risk register (escalations), expansion opportunities, and renewal strategy.

### Dashboards

Customer success, onboarding, scaled portfolio, enterprise account, customer health, and renewal dashboards are exposed via the dashboard and workspace endpoints.

### AI placeholders

Onboarding plan generator, customer health summary, churn risk prediction, adoption recommendation, QBR/EBR summary, executive account brief, renewal strategy recommendation, and customer success email draft — all permission-aware and deferred until the AI Gateway phase.
