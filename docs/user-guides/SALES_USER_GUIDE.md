# Sales User Guide

## Purpose

This guide explains how sales-facing users can work with the live CRM and sales workspace through Phase 10.

## What Is Available

The current release includes:
- leads
- accounts
- contacts
- opportunities
- role-aware navigation
- protected routes
- notes, activities, tasks, and timeline support on detail pages

Your visible modules and actions depend on:
- your assigned roles
- the permissions in those roles
- whether the tenant admin has enabled the module

## Logging In

Use the seeded admin account for local verification:

- tenant slug: `sample-tenant`
- email: `admin@sample-tenant.local`
- password: `ChangeMe123!`

After login:
- the app loads your current user
- tenant theme and terminology settings are applied
- the sidebar hides modules you are not allowed to access

## Leads Workflow

### Lead List

The Leads page supports:
- search by name, company, email, or phone
- filter by status
- filter by source
- filter by owner
- sort and pagination

### Lead Detail

Each lead detail page shows:
- lead identity
- company
- source and status
- owner
- score placeholder
- notes
- activities
- conversion placeholder

### Create or Edit Lead

The lead form supports:
- first name
- last name
- company
- email
- phone
- status
- source
- owner
- score placeholder

## Accounts Workflow

### Account List

The Accounts page supports:
- search by name, website, or industry
- filter by account type
- filter by owner
- sort and pagination

### Account Detail

Each account detail page shows:
- account name
- website
- industry
- owner
- account type
- account health placeholder
- related contacts
- related opportunities placeholder
- notes
- activities

### Create or Edit Account

The account form supports:
- account name
- website
- industry
- account type
- account health placeholder
- owner

## Contacts Workflow

### Contact List

The Contacts page supports:
- search by name, email, phone, or account
- filter by contact role
- filter by account
- filter by owner
- sort and pagination

### Contact Detail

Each contact detail page shows:
- stakeholder identity
- email
- phone
- LinkedIn
- owner
- related account
- notes
- activities

### Create or Edit Contact

The contact form supports:
- first name
- last name
- email
- phone
- LinkedIn
- role
- owner
- related account

## Opportunities Workflow

### Opportunity List

The Opportunities page supports:
- search by name, account, contact, competitor, or next step
- filter by stage
- filter by source
- filter by outcome status
- filter by owner, account, and contact
- stalled-deal filtering
- my pipeline, team pipeline, and all pipeline scopes based on permission
- sorting and pagination

### Opportunity Dashboard and Kanban

The opportunity workspace also shows:
- visible pipeline count
- pipeline value
- closing this month metrics
- stalled deals metrics
- stage distribution
- forecast placeholder
- deal risk placeholder
- Kanban stage movement with audit logging

### Opportunity Detail

Each opportunity detail page shows:
- linked account
- linked primary contact
- owner
- stage, source, and outcome status
- amount and probability
- expected close date
- competitor
- stakeholders
- next step
- win and loss reason
- products and services placeholder
- notes
- activities
- tasks
- timeline

### Create or Edit Opportunity

The opportunity form supports:
- opportunity name
- linked account
- linked primary contact
- owner
- stage
- source
- outcome status
- amount
- probability
- expected close date
- competitor
- stakeholder contacts
- next step
- win and loss reason

## Permissions and Visibility

Typical behavior:
- users without module permissions do not see the module in navigation
- users without create permissions cannot open create forms
- users without edit permissions cannot open edit forms
- users without delete permissions do not see delete actions
- users without timeline write permissions cannot add notes or activities

## Current Limits

Still not implemented:
- lead conversion
- dynamic custom fields in the live CRM forms
- public registration
- record-level authorization beyond tenant boundaries
- true forecast modeling, deal-risk scoring, proposal drafting, and win-probability AI execution
