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

## Phase 0 Note

This document defines the future training capability only. No customer training module exists yet.
