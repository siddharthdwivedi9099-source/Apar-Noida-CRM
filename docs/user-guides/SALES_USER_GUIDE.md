# Sales User Guide

## Purpose

This guide explains how sales-facing users can work with the Phase 6 CRM foundation.

## What Is Available

The current release includes:
- leads
- accounts
- contacts
- role-aware navigation
- protected routes
- notes and activities on detail pages

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

## Permissions and Visibility

Typical behavior:
- users without module permissions do not see the module in navigation
- users without create permissions cannot open create forms
- users without edit permissions cannot open edit forms
- users without delete permissions do not see delete actions
- users without timeline write permissions cannot add notes or activities

## Current Limits

Still not implemented:
- opportunities
- lead conversion
- dynamic custom fields in the live CRM forms
- public registration
- record-level authorization beyond tenant boundaries
