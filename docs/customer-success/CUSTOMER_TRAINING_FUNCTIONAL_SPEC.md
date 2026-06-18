# Customer Training Functional Specification

## Purpose

This document defines how customer training should be represented and managed within the platform to support onboarding, adoption, enablement, and ecosystem readiness.

## Scope

This document covers:
- training actors and use cases
- training objects
- workflow expectations
- reporting expectations
- implementation guidance

This document does not cover:
- live classroom tooling
- external LMS integration details
- content authoring systems

## Objectives

- support structured customer education programs
- track training readiness and completion
- connect training outcomes to onboarding and success workflows
- enable future use of training assets in governed knowledge systems

## Primary Actors

- Training Specialist
- Customer Success Manager
- Onboarding Specialist
- Partner Manager
- Customer Learner

## Core Capabilities

### Program Management

- define training programs and learning paths
- group related courses or sessions
- align programs to onboarding, product area, or persona

### Session Management

- schedule sessions
- assign facilitators and participants
- track attendance and follow-up needs

### Progress and Completion Tracking

- record enrollment
- track completion status
- capture assessment or certification outcomes where applicable

### Training Asset Governance

- organize training material references
- maintain ownership and lifecycle visibility
- support later reuse in knowledge and AI contexts

## Required Objects

- training program
- learning path
- session
- participant enrollment
- completion record
- training asset
- certification result

## Workflow Expectations

- training should align to onboarding stage or customer objective
- completion data should be available to success and onboarding teams
- training should support cohort and account-level reporting
- feedback should be captured in a structured form where useful

## Reporting Expectations

- session utilization
- completion rates
- certification status
- customer readiness indicators
- feedback and quality trends

## Implementation Guidance

When implementation begins:
- model training as a structured capability rather than as loose attachments
- connect training records to accounts, contacts, onboarding plans, and success context
- preserve content lineage so approved assets can later feed knowledge systems
- keep reporting dimensions in mind when modeling sessions and enrollments

## Phase 17 Implementation

The customer training module is implemented in Phase 17, backed by nine tenant-scoped tables (`training_programs`, `training_modules`, `training_lessons`, `training_assets`, `training_assignments`, `customer_learners`, `training_progress`, `training_feedback`, `training_certifications`) and governed by the `training.*` permission set.

### Content authoring

- Create training programs with a category, level, status, estimated duration, and an optional role-based flag.
- Add modules to a program and lessons to a module (article, video, quiz, or interactive).
- Link assets to lessons (upload/link placeholder).

### Assignment and tracking

- Assign a program to a user, contact, or account, optionally linking a customer success account and an onboarding plan.
- Track progress per lesson; the assignment's completion percent and status (assigned → in progress → completed) are recomputed automatically.
- Capture feedback (1–5 rating and comments).
- A training dashboard reports program and assignment totals, completion average, average rating, and category/status distributions.

### Customer portal

The learner portal (`GET /training/portal/my-training`) returns the current user's assignments with assigned, in-progress, and completed counts plus a recommended-training placeholder.

### Placeholders

Role-based learning paths, training certifications, and recommended training are exposed as placeholders for later phases.

### AI placeholders

AI product trainer, learning path recommender, lesson summarizer, quiz generator, and knowledge gap detection — all permission-aware and deferred until the AI Gateway phase.

### Customer AI Query Bot (Phase 21)

Training content is one of the approved knowledge sources the Customer AI Query Bot retrieves from. Learner questions asked through Ask AI are answered from approved training and product knowledge, cited, and escalated when needed; questions the knowledge base cannot answer are recorded as knowledge gaps, which informs which training content and lessons to create or improve. See [../ai/CUSTOMER_QUERY_AI_DESIGN.md](../ai/CUSTOMER_QUERY_AI_DESIGN.md).
