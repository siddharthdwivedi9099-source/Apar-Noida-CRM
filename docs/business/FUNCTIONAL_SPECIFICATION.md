# Functional Specification

## Purpose

This document describes the platform-level functional behavior expected from the product and highlights what is now implemented through Phase 5.

## Functional Design Principles

- Every function operates within tenant context.
- Access is role-based and policy-aware.
- Administrative changes are auditable.
- Configuration should be tenant-specific from the beginning.
- CRM business modules should consume shared tenant settings instead of hardcoding labels or catalogs.

## Implemented Shared Platform Functions

### Authentication and Session Control

Implemented:
- tenant-aware login
- logout
- refresh token rotation
- current-user loading
- protected frontend routes
- login audit logging
- failed login handling and rate limiting

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
- module enable/disable settings
- terminology configuration
- configurable option-set foundation
- configurable pipeline stages foundation
- configurable support ticket status foundation
- configurable customer-success stage foundation
- custom field metadata foundation
- custom form layout metadata foundation

Current runtime behavior:
- tenant theme changes affect the live shell
- module switches affect navigation and route access
- terminology changes affect navigation and module copy
- custom fields are managed as metadata for later CRM forms

### Audit and Traceability

Implemented:
- auth audit events
- RBAC audit events
- tenant configuration audit events

## Tenant Configuration Functional Detail

### Workspace Settings

The tenant admin can define:
- workspace name
- timezone
- locale
- currency
- date format
- time format

### Theme Settings

The tenant admin can define:
- logo
- primary color
- secondary color
- accent color
- light or dark mode
- sidebar style
- card style
- font preference
- compact or comfortable density

### Module Settings

The tenant admin can:
- enable a module
- disable a module
- immediately change whether the module appears in the shell
- immediately block disabled module routes

### Terminology Settings

The tenant admin can rename key business-facing labels such as:
- Leads
- Accounts
- Contacts
- Opportunities
- Campaigns
- Support/Tickets
- Customer Success

### Option-Set Foundation

The tenant can hold configurable values for:
- dropdown catalogs
- opportunity pipeline stages
- ticket statuses
- customer-success stages

These values are stored as tenant metadata so later CRM modules can consume them without new schema changes.

### Custom Field Foundation

The tenant admin can define metadata including:
- module
- entity key
- field key
- label
- data type
- required flag
- active flag
- option-set linkage

These fields are not yet rendered in production CRM forms, but the foundation is implemented.

### Custom Form Layout Foundation

The platform stores tenant-scoped layout metadata so future CRM forms can:
- group fields into sections
- maintain different layouts per entity
- evolve without destructive schema work

## Functional Modules Still Pending

The following business modules remain future work even though their configuration and permission vocabulary now exist:
- leads
- accounts
- contacts
- opportunities
- campaigns
- support
- customer success
- partner and reseller workflows
- onboarding and training execution

## Next Functional Step

The next CRM phase should consume Phase 5 foundations directly by:
- reading tenant terminology for labels
- reading tenant option sets for dropdowns and stages
- reading custom field metadata in forms
- preserving RBAC and tenant isolation in all business CRUD workflows
