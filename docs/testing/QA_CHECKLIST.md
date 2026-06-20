# Manual QA Checklist

This checklist complements the automated suites described in
[TESTING_STRATEGY.md](./TESTING_STRATEGY.md). Automated tests guard logic and
contracts; this checklist covers human-verified behavior before a release.

## How to use this checklist

- Run the automated gates first: `npm test`, `npm run typecheck`, `npm run build`.
- Then work through the relevant sections below in a seeded local environment.
- Record the result (pass / fail / N/A) and link any defects.
- Any failure blocks the release until fixed or explicitly waived.

## Pre-flight (environment)

- [ ] `npm install` completes cleanly.
- [ ] PostgreSQL is running and `npm run db:migrate` reports no pending migrations.
- [ ] `npm run db:seed` succeeds and the default tenant + admin exist.
- [ ] `npm run dev` starts both web (`http://localhost:5173`) and API (`/api/v1`).
- [ ] `GET /api/v1/` reports the expected `phase-*-operational` status.

## Authentication

- [ ] Login with valid admin credentials succeeds and lands on the dashboard.
- [ ] Login with a wrong password shows an inline error and does not authenticate.
- [ ] Login with an unknown tenant slug fails cleanly.
- [ ] Refreshing the page keeps the user signed in (session bootstrap).
- [ ] Logout clears the session and returns to the login screen.
- [ ] Repeated failed logins eventually lock the account (lockout threshold).

## RBAC and tenant isolation

- [ ] A non-admin persona cannot see admin navigation or open `/admin` routes.
- [ ] A user without a module permission is blocked from that module's route.
- [ ] Role-based navigation only shows modules the persona can access.
- [ ] A persona created for one tenant cannot read another tenant's records.
- [ ] Removing a permission from a role immediately restricts the affected route.

## Core CRM (leads, accounts, contacts, opportunities)

- [ ] Create, edit, and view a lead; the audit trail records the change.
- [ ] Create, edit, and view an account and a contact.
- [ ] Create an opportunity and move it across pipeline stages on the board.
- [ ] List filters, search, and pagination behave as expected.
- [ ] Cross-record links (account → contacts → opportunities) resolve.

## Campaigns and marketing

- [ ] Create a campaign and add/update members.
- [ ] Campaign metrics and member status changes persist.

## Support / tickets

- [ ] Create a ticket, change its status, and add a reply.
- [ ] SLA / priority / category fields persist and display correctly.

## Customer success and training

- [ ] The customer success dashboard loads health and renewal data.
- [ ] Training assignments and lesson progress update correctly.

## AI surfaces

- [ ] The AI assistant panel loads providers, templates, settings, and usage.
- [ ] AI actions return governed placeholder output without leaking errors.
- [ ] Prompt and agent registries load and respect permissions.
- [ ] Ask AI / customer query returns answers and escalates level-3 queries.

## Dashboards, workflows, notifications, approvals

- [ ] Role-appropriate dashboards render with live widgets and date filters.
- [ ] A workflow can be created, run, and its run logs inspected.
- [ ] Notifications and the approval inbox list, open, and action items.

## Audit, security, and governance (Phase 27)

- [ ] Audit log list, filters, summary, and export work for an admin persona.
- [ ] A read-only admin is denied export and governance updates (403).
- [ ] Data governance settings load and update; the change is audited.
- [ ] A denied request for an authenticated user is recorded as failed access.

## Customer portal

- [ ] A portal user lands on `/portal` and only sees their account's data.
- [ ] Internal-only fields and other accounts' records are never exposed.

## Cross-cutting

- [ ] No console errors on primary pages.
- [ ] Error states (network failure, empty data) render friendly messages.
- [ ] Security headers present and `x-powered-by` absent on API responses.
- [ ] Theme, terminology, and module toggles reflect tenant configuration.

## Regression process

1. Reproduce the defect and capture exact steps + expected vs. actual.
2. Add a failing automated test (backend or frontend) that encodes the bug.
3. Fix the code until the new test and the full `npm test` suite pass.
4. Re-run the relevant `tests/phase*-exhaustive.mjs` script if live data is involved.
5. Re-walk the affected section of this checklist.
6. Note the fix in [CHANGELOG.md](../../CHANGELOG.md).
