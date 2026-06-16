# Functional Specification

## Purpose

This document summarizes the platform behavior now implemented through Phase 6.

## Functional Principles

- Every function runs inside tenant context.
- Every business module inherits RBAC and audit logging.
- Tenant configuration should feed CRM behavior instead of hardcoded UI vocabulary.
- Core CRM records should be soft-delete-safe and extensible from the beginning.

## Implemented Platform Functions

### Authentication and Session Control

Implemented:
- tenant-aware login
- logout
- refresh token rotation
- current-user loading
- protected frontend routes
- login audit logging
- failed-login handling and rate limiting

### Role and Permission Management

Implemented:
- permission catalog
- role templates
- role CRUD
- permission assignment to roles
- role assignment to users
- permission-aware navigation
- permission middleware in the API

### Tenant and Configuration Engine

Implemented:
- tenant workspace settings
- tenant theme settings
- module enable and disable settings
- terminology configuration
- configurable option-set foundation
- configurable pipeline, ticket-status, and customer-success-stage catalogs
- custom field metadata foundation
- custom form layout foundation

Current runtime behavior:
- tenant theme changes affect the live shell
- module switches affect navigation and route access
- terminology changes affect navigation labels and CRM page copy
- CRM forms now consume tenant-backed dropdown catalogs for lead, account, and contact fields

### Audit and Traceability

Implemented:
- auth audit events
- RBAC audit events
- tenant configuration audit events
- CRM create, update, delete, note, and activity audit events

## Implemented CRM Functions

### Lead Module

Implemented:
- lead list
- lead detail
- create lead
- edit lead
- soft delete lead
- assign owner
- lead status
- lead source
- lead score placeholder
- lead notes
- lead activities
- conversion placeholder

Cross-cutting behavior:
- pagination, search, filters, and sorting
- tenant isolation
- API validation
- RBAC-backed route and action gating
- audit logging on write operations

### Account Module

Implemented:
- account list
- account detail
- create account
- edit account
- soft delete account
- owner assignment
- account type
- industry
- website
- account health placeholder
- related contacts
- related opportunities placeholder
- notes
- activities

Cross-cutting behavior:
- pagination, search, filters, and sorting
- tenant isolation
- API validation
- RBAC-backed route and action gating
- audit logging on write operations

### Contact Module

Implemented:
- contact list
- contact detail
- create contact
- edit contact
- soft delete contact
- owner assignment
- contact role
- account relationship
- email
- phone
- LinkedIn
- notes
- activities

Cross-cutting behavior:
- pagination, search, filters, and sorting
- tenant isolation
- API validation
- RBAC-backed route and action gating
- audit logging on write operations

## Frontend Functional Behavior

Implemented:
- list pages for leads, accounts, and contacts
- detail pages for leads, accounts, and contacts
- create and edit forms for leads, accounts, and contacts
- empty states and loading states
- role-aware action buttons
- protected routes for list, detail, create, and edit flows

Current UX behavior:
- unauthorized users do not see modules in navigation
- disabled tenant modules are blocked at the route layer
- form dropdowns use tenant-configured option sets
- notes and activities are managed directly from detail pages

## Functions Still Pending

Still out of scope:
- public registration
- admin-created user lifecycle UI
- opportunity management
- lead conversion workflow
- dynamic custom-field rendering in live CRM forms
- record-level authorization beyond tenant boundaries
