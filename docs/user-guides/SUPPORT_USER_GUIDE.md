# Support User Guide

## Purpose

This guide explains how support agents and managers use the Support workspace introduced in Phase 15.

## Accessing the workspace

Open **Support** from the navigation. The module appears for roles with Support access (for example the seeded Support Executive and Support Manager roles) and when the tenant has the Support module enabled.

## Support dashboard

The top of the workspace shows service metrics for your visibility scope:
- Open tickets and total tickets
- SLA breached and unassigned tickets
- Escalated and resolved tickets
- Knowledge base article count

## Ticket queue

The queue shows each ticket's status, priority, SLA breach indicator, escalation flag, account, category, assignee, message count, and linked article count. Select a ticket to open its detail panel.

## Creating a ticket

1. Click **Create ticket** (requires create permission).
2. Enter the subject and choose priority, category, and source.
3. Optionally attach an SLA policy (which sets first-response and resolution due dates), link an account, and assign an agent.
4. Add a description and submit; the new ticket opens automatically.

## Working a ticket

The detail panel lets you:
- Update **status**, **priority**, **assignee**, and **escalation** inline (with edit/assign permission).
- Review the **SLA** policy, first-response and resolution due dates, and breach badges.
- Read the description, related account/contact/customer success account, root cause, and resolution notes.
- Add **internal notes** or **customer replies** in the conversation; the first customer reply records the SLA first-response time.
- Review and **link knowledge articles** to the ticket.
- See permission-aware AI placeholders (classification, suggested response, similar tickets, knowledge recommendation, summary, escalation recommendation).

## Knowledge base and SLA policies

- The knowledge base panel lists articles and lets roles with create permission add new ones (title, category, summary).
- The SLA policies panel lists configured policies with their first-response and resolution targets.

## Permission behavior

- Users without Support access do not see the module in navigation.
- Users without create permission cannot open the create form.
- Users without edit permission cannot change ticket fields, add messages, or link articles.
- Users without assign permission cannot reassign tickets.
- SLA policy creation requires configure or workflow permissions.

## Customer AI Query Review (Phase 21)

The **Query Review** page (`/customer-query`) lets support and customer success review customer AI conversations.

- **Sessions** — browse customer query sessions with status, escalation level, channel, and message counts. Filter to escalated sessions to triage.
- **Conversation** — open a session to see every customer question and AI answer, the citations used, confidence scores, query level, and feedback.
- **Escalations** — Level 3 and unanswered questions are auto-escalated and create a support ticket; low-confidence answers are flagged for review. Each escalation shows its reason and any linked ticket.
- **Resolve** — mark a reviewed session resolved (requires assign/manage permissions); this also closes its open escalations.
- **Knowledge gap dashboard** (`/customer-query/gaps`) — see unanswered and low-confidence queries plus query-level analytics so you can close gaps in the approved knowledge base.

The AI bot answers only from approved knowledge sources, respects tenant permissions, and logs every query and answer.

## Current limits

- Attachments, CSAT capture, and automated escalation workflows are placeholders.
- The knowledge base is a lightweight placeholder library.
- AI placeholder actions are visible but deferred until the AI Gateway phase.
- The customer AI query bot composes grounded answers from approved knowledge; live LLM generation is deferred.
