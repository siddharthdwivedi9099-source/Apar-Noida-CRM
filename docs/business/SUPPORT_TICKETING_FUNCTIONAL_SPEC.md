# Support Ticketing Functional Specification

## Purpose

This document describes the support ticketing capabilities delivered in Phase 15: ticket management, SLA tracking, escalation, conversation, and the knowledge base.

## Scope

Phase 15 introduces a tenant-aware support module backed by the `support_sla_policies`, `support_tickets`, `support_ticket_messages`, `support_knowledge_articles`, and `support_ticket_articles` tables. Access is governed by the `support.*` permission set and tenant module switches.

## Ticket Module

Each ticket captures:
- Subject and description
- Status (new, in progress, waiting on customer, resolved, closed)
- Priority (low, medium, high, urgent)
- Category (technical, billing, how-to, bug, feature request, other)
- Source (email, portal, phone, chat, API)
- Owner and assignee (assignment)
- Related account, contact, and customer success account
- Escalation status (none, pending, escalated, resolved)
- Root cause and resolution notes
- Internal notes and customer-visible replies (ticket messages)
- Attachments placeholder
- CSAT placeholder

Ticket operations include create, read, update, assign, and soft delete, plus adding messages and linking knowledge articles.

## SLA

- SLA policy configuration: named policies with an optional priority, a first-response target (minutes), and a resolution target (minutes).
- SLA due-date calculation: attaching a policy to a ticket computes `first_response_due_at` and `resolution_due_at` from ticket creation time.
- SLA breach status: computed at read time. First response is breached when the first customer reply (or now, if none) is after the first-response due date; resolution is breached when the resolved time (or now, if unresolved) is after the resolution due date.
- The first customer-visible reply records the SLA first-response time.
- Escalation placeholder: automated escalation workflows are deferred; escalation status is tracked as a field.

## Knowledge Base (placeholder)

- Knowledge article list with title, category, summary, body, and status (draft, published, archived).
- Article categories via the `support-knowledge-category` option set.
- Link article to ticket through the ticket-articles junction.
- The article library and retrieval are intentionally lightweight placeholders for a future knowledge management module.

## AI Placeholders

Permission-aware, deferred until the AI Gateway phase:
- Ticket classification
- Suggested response
- Similar tickets
- Knowledge recommendation
- Ticket summary
- Escalation recommendation

## Permissions and Visibility

- All support routes require one of the `support.*` permissions.
- Visibility follows owner/team/all scoping; `mine` matches the ticket owner or assignee.
- Assignment changes require `support.assign` or `support.configure`.
- SLA policy configuration requires `support.configure` or `support.manage_workflow`.

## Out of Scope (Phase 15)

- Customer-facing support portal
- File attachment storage and CSAT survey execution (placeholders only)
- Automated escalation and routing workflows
- AI execution for the support AI placeholders
