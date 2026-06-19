# Customer Portal User Guide

## Purpose

Phase 26 adds a customer-facing portal at `/portal`. It gives external customer users a safe view of their own account data without exposing the internal CRM workspace.

## Access

Customer portal users sign in through the normal login page with a customer portal role and an active `customer_portal_profiles` record. Customer-only users are routed to `/portal/dashboard` after login.

## Portal Areas

- **Dashboard** — account summary, ticket counts, training counts, knowledge count, active AI sessions, product announcement placeholder, and CSAT prompt.
- **Tickets** — view customer-visible tickets for your account, create a support ticket, track status, and add customer replies.
- **Knowledge** — search approved customer-visible knowledge articles.
- **Ask AI** — ask questions answered only from approved customer-visible knowledge.
- **Training** — view assigned published training and mark lessons complete.
- **Profile** — view linked account/contact details, update phone/job title, and submit feedback or CSAT.

## Ticket Rules

- Tickets are automatically linked to the customer user's account.
- Portal users cannot choose another account or internal assignee.
- Internal notes, root-cause fields, owner fields, and internal resolution notes are not shown in the portal.
- Customer replies are stored as `customer_reply` messages.

## AI Rules

Ask AI uses only approved, published knowledge articles from enabled tenant-scoped sources with no required internal permission. Restricted sources and internal CRM records are excluded. If no approved answer is found, the portal returns a no-answer response and logs the interaction for review rather than guessing.

## Security Expectations

- Customer users must have `customer_portal.*` permissions.
- Every portal API request is tenant-scoped.
- Every ticket and training query is constrained by the active portal profile's account/contact/user boundary.
- Customer portal pages use a separate shell from the internal CRM navigation.
