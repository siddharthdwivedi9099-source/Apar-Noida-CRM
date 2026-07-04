---
title: "AI-Native CRM — Module Guide"
subtitle: "User Manual: what every module does and how it fits together"
---

**Audience:** every user, evaluator, and administrator of the platform.
**Scope:** a module-by-module explanation of the application — what each module is for, the screens it provides, what you can do in it, how it connects to the rest of the CRM, and where AI assists.
**Companion document:** *Persona-Wise Workflow Guide* (step-by-step tasks for each role).

> **How to read this guide.** Screen paths in `monospace` are the in-app routes (the part of the URL after the host). The left navigation **adapts to your role and your tenant's enabled modules**, so you may not see every module listed here. Labels can be renamed by your administrator (e.g. "Opportunities" → "Deals"); the behaviour is the same.

---

## How the platform is organised

The CRM is a single, multi-tenant workspace that unifies the full customer lifecycle behind one governed AI layer:

| Layer | Modules |
|-------|---------|
| **Acquire** | Leads, Campaigns, Social, SDR & Inside-Sales workspaces |
| **Sell** | Accounts, Contacts, Opportunities & Pipeline, Business Development, Presales |
| **Channel** | Partners, Resellers (deal registration) |
| **Serve & retain** | Support / Tickets, Customer Success, Customer Query, Customer Portal |
| **Enable** | Training, Knowledge Base & RAG |
| **Govern AI** | AI Assistant, AI Actions / Agents / Prompts |
| **Operate** | Dashboards & Analytics, Notifications, Approvals, Workflows |
| **Administer** | Administration (RBAC, Modules, Theme, Terminology, Custom Fields, Audit) |

Every module shares the same foundations:

- **Tenant isolation** — you only ever see your own organisation's data; cross-tenant access is impossible by design.
- **Role-based access control (RBAC)** — each module exposes a consistent set of permissions (`view`, `create`, `edit`, `delete`, `assign`, `approve`, `export`, `import`, `configure`, `use_ai`, `manage_ai`, `manage_workflow`, `view_dashboard`). If a screen or button is missing, your role doesn't grant it.
- **Audit trail** — sensitive events (logins, permission denials, exports, configuration changes, AI runs) are recorded.
- **Governed AI** — AI is available throughout, but **sensitive AI outputs require human review** before they're considered usable, and grounded answers cite their sources.
- **Soft delete** — most "Delete" actions archive a record (restorable by an admin) rather than destroying data.

---

## 1. Dashboards & Analytics

**Path:** `/dashboard`, `/analytics`

**Purpose.** Your landing overview and the analytics workspace for pipeline, campaigns, support, customer-success health, and executive rollups.

**What you can do**

- Open role-relevant dashboards; **set a personal default dashboard** that opens on sign-in.
- Apply **date filters**, **drill down** into widgets, and **export** (exports are audit-logged).
- Create and manage your own **saved views**.

**Works with.** Reads from every operational module (Leads, Opportunities, Campaigns, Support, CS). Visibility is role-aware — you only see dashboards your permissions grant (`*.view_dashboard`).

**AI here.** Executive insight summaries and widget explanations via the AI Assistant.

---

## 2. Leads

**Path:** `/leads`, `/leads/new`, `/leads/:leadId`

**Purpose.** Capture and qualify prospective customers before they become accounts and opportunities. In the seeded education demo, Leads holds 200+ education organisations (pre-schools, K12 schools, colleges, universities, coaching institutes, tuition centres, professional-studies and vocational institutions) tagged with the eLite SIS products they fit.

**What you can do**

- Create, edit, score, assign, and status leads (status/source are configurable option sets).
- Filter, search, sort, and use saved views to work a queue.
- Convert/hand off qualified leads to inside sales or an account executive.

**Works with.** SDR & Inside-Sales workspaces (queues), Accounts/Contacts/Opportunities (conversion), Campaigns (membership and attribution).

**AI here.** Lead summaries, intent detection, and follow-up draft emails (sensitive drafts return for review).

---

## 3. Accounts

**Path:** `/accounts`, `/accounts/:accountId`

**Purpose.** The organisations you sell to and serve — the relationship hub.

**What you can do**

- Maintain account records, owners, related contacts, and opportunities.
- Review the account **timeline** (meetings, emails, notes).

**Works with.** Contacts, Opportunities, Customer Success (managed accounts), Support (customer context), Resellers/Partners (sourced accounts), Customer Portal (a portal user is linked to an account).

**AI here.** Account brief / relationship summary on demand.

---

## 4. Contacts

**Path:** `/contacts`, `/contacts/:contactId`

**Purpose.** The people inside accounts — decision-makers, champions, and end users.

**What you can do.** Create and maintain contacts, associate them with accounts, campaigns, and activities; keep notes and timelines current.

**Works with.** Accounts, Leads, Campaigns (members), Opportunities (stakeholders), Support (requesters).

---

## 5. Opportunities & Pipeline

**Path:** `/opportunities`, `/opportunities/new`, `/opportunities/:id`

**Purpose.** Manage active deals from creation through close on a stage-based pipeline.

**What you can do**

- Run the full opportunity lifecycle: create, edit, set value/close date, and move **stages** (role-aware; some transitions may require permission).
- Work the **Kanban pipeline** or list; spot stalled deals.
- Stage changes are audited.

**Works with.** Accounts/Contacts (relationships), Resellers (deal registration links a reseller to an opportunity), Presales/BD (deal support), Dashboards (pipeline metrics and forecast).

**AI here.** Deal summaries and next-step suggestions.

---

## 6. Sales Workspaces — SDR & Inside Sales

**Path:** `/sales/sdr`, `/sales/inside-sales`

**Purpose.** Focused, prioritised cockpits for the two front-line selling motions.

- **SDR workspace** — a prioritised lead queue for prospecting and qualification, with next steps.
- **Inside-sales workspace** — progress qualified leads into opportunities and manage a book of smaller deals.

**Works with.** Leads, Accounts, Contacts, Opportunities. Managers get team dashboards and can reassign work.

**AI here.** Lead summaries and follow-up drafts inside the queue.

---

## 7. Business Development

**Path:** `/business-development`

**Purpose.** Drive strategic pipeline and partnerships beyond standard inbound sales.

**What you can do.** Create and track BD initiatives and their pipeline entries; link related accounts/opportunities; record progress and next steps.

**Works with.** Partners/Resellers and Presales collaboration; Opportunities.

---

## 8. Presales

**Path:** `/presales`

**Purpose.** Support deals with technical qualification, demos, and proposals.

**What you can do.** Track presales engagements and deliverables linked to opportunities; record technical qualification, demo notes, and proposal status.

**Works with.** Opportunities (deal support), AI Actions (proposal outlines route for review before sending).

---

## 9. Campaigns (Marketing)

**Path:** `/campaigns`, `/campaigns/new`

**Purpose.** Plan and run marketing programs and manage marketing-sourced pipeline.

**What you can do**

- Full campaign lifecycle: create, edit, set type/dates/goals, and manage **members** (target leads/contacts).
- Track performance on the campaign dashboard.

**Works with.** Leads/Contacts (membership and attribution), Dashboards (campaign metrics).

**AI here.** Campaign plans, email copy, and audience suggestions (sensitive → review).

---

## 10. Social

**Path:** `/social`, `/social/new`

**Purpose.** Create, schedule, and track social media content.

**What you can do.** Compose posts, set channel and schedule, and track engagement on the post detail screen.

**AI here.** Captions and hashtag suggestions (sensitive → review).

---

## 11. Partners

**Path:** `/partners`

**Purpose.** Manage partner relationships and partner-sourced pipeline.

**What you can do.** Maintain partner records, tiers, contacts, and engagement notes; track partner-sourced opportunities.

**Works with.** Business Development, Resellers, Opportunities.

---

## 12. Resellers

**Path:** `/resellers`

**Purpose.** Manage resellers, **deal registration**, and channel pipeline with margins.

**What you can do.** Maintain reseller records; **register deals** (links a reseller to an opportunity with margin/agreement details); track status through a scoped pipeline (visibility scoped to the resellers/owners you're permitted to see).

**AI here.** Reseller-growth insights.

---

## 13. Support / Tickets

**Path:** `/support`, `/tickets`

**Purpose.** Resolve customer issues and manage the support queue and SLAs.

**What you can do**

- Create, triage, update, assign, escalate, and resolve **tickets** with full history and customer context.
- Managers oversee assignment, escalation, and support dashboards.
- Review AI customer-query sessions that escalated into tickets.

**Works with.** Accounts/Contacts (customer context), Customer Query (escalations), Customer Portal (customer-raised tickets), Knowledge Base (answers).

**AI here.** Suggested replies and ticket summaries (sensitive → review).

---

## 14. Customer Success

**Path:** `/customer-success`

**Purpose.** Drive adoption, health, onboarding, and renewals. Variants: Onboarding, Scaled, Enterprise, plus CS Head oversight.

**What you can do.** Manage assigned accounts, **health scores**, onboarding plans, and playbooks; monitor at-risk accounts; CS Head sees portfolio rollups.

**Works with.** Accounts (managed accounts), Dashboards (health), Training (adoption).

**AI here.** Health-indicator explanations and account briefs.

---

## 15. Training

**Path:** `/training`

**Purpose.** Build and deliver learning paths, courses, and learner progress tracking — internal enablement and customer training.

**Works with.** Knowledge Base, Customer Portal (assigned training for external users).

---

## 16. Knowledge Base & RAG

**Path:** `/knowledge`, `/knowledge/articles`, `/knowledge/upload`, `/knowledge/rag-console`, knowledge-gap dashboard

**Purpose.** Curate the knowledge that grounds every AI answer, and inspect how retrieval works.

**What you can do**

- Author, review, **approve**, and **publish** articles. Only approved + published, permission-appropriate articles are used by AI retrieval and the customer-query bot.
- Upload documents and use the **RAG console** to preview what the AI would retrieve for a query and verify permission filtering.
- Review **knowledge gaps** (recurring unanswered queries) and close them by authoring articles.

**Works with.** AI Assistant / Customer Query (grounding + citations), Support (answers), Customer Portal (browsable articles).

---

## 17. Customer Query (AI Bot Review)

**Path:** `/customer-query`, `/customer-query/gaps`

**Purpose.** The review surface for questions the AI bot handled or escalated.

**What you can do.** Inspect sessions the bot escalated (low confidence, no approved answer, or sensitive topics), review the grounded answer and citations, take over or convert to a ticket, and see the **knowledge gaps** that tell authors what to write next.

**Works with.** Knowledge Base (gaps → articles), Support (escalations → tickets), Customer Portal (where end users ask).

---

## 18. Customer Portal (External)

**Path:** `/portal/*`

**Purpose.** A self-service workspace for external customers — fully scoped to their own organisation.

**What customers can do**

- **Dashboard** — their overview.
- **Tickets** — raise and track support tickets.
- **Ask AI** — get answers grounded **only** in approved knowledge with citations, or an automatic escalation (often creating a ticket) when no confident answer exists.
- **Knowledge** — browse permitted articles.
- **Training** — access assigned training.
- **Profile** — manage their details.

**Works with.** Support, Knowledge Base, Customer Query, Training. Portal users are linked to an account and never see another customer's data.

---

## 19. AI Assistant

**Path:** `/ai-assistant`, `/ask-ai`, `/ai-help`

**Purpose.** A governed assistant available across the app wherever your permissions allow (`ai.use_ai`).

**How it behaves.** Prompts come from a managed registry (never hardcoded), every run is logged, **sensitive outputs require human review**, and retrieval-grounded answers cite their sources rather than fabricating.

**Works with.** Every module that exposes summaries/drafts; Knowledge Base for grounding; Approvals for sensitive output review.

---

## 20. AI Actions, Agents & Prompts (AI Governance)

**Path:** `/ai-actions`, `/ai-agents`, `/ai-prompts`, plus tenant AI settings and usage logs

**Purpose.** The control room for the AI layer.

**What you can do**

- **AI Actions** (`/ai-actions`) — review predefined AI task runs and **approve/reject** sensitive outputs (audit-logged; only approved outputs are usable).
- **Prompt Registry** (`/ai-prompts`) — versioned, approvable prompt templates; callers reference them by `templateKey`.
- **Agent Registry** (`/ai-agents`) — agents with declared tools, data scope, and human-approval rules.
- Configure tenant **AI settings** (provider/model, rate limit, redaction, logging) and monitor **usage logs**.

**Works with.** Every AI touchpoint runs through this one governed gateway; Approvals and Audit enforce governance.

---

## 21. Notifications

**Path:** `/notifications`

**Purpose.** In-app notifications with per-user **preferences** (what you're notified about) and **mark read / mark all read**.

**Works with.** Workflows and Approvals (event sources).

---

## 22. Approvals

**Path:** `/approvals`

**Purpose.** A generic approval inbox used by workflows and sensitive actions.

**What you can do.** Review approval requests, **approve/reject**, and comment. Approvals are permissioned and audited.

**Works with.** Workflows (steps), AI Actions (sensitive output review), Notifications.

---

## 23. Workflows

**Path:** `/workflows`

**Purpose.** Automations with conditions and actions, managed by admin/ops users.

**What you can do.** Create and manage automations; runs integrate with **Approvals** and **Notifications**.

**Works with.** Notifications, Approvals, and any module the automation acts on.

---

## 24. Administration

**Path:** `/admin` → `rbac`, `modules`, `theme`, `terminology`, `custom-fields`, plus audit/governance

**Purpose.** Configure the tenant without code changes.

**What you can do**

- **RBAC** (`/admin/rbac`) — create roles and assign module permissions.
- **Modules** (`/admin/modules`) — enable/disable modules per tenant (disabled modules disappear from navigation).
- **Theme** (`/admin/theme`) — colours and logo.
- **Terminology** (`/admin/terminology`) — rename objects to match your vocabulary.
- **Custom Fields** (`/admin/custom-fields`) — extend business objects.
- Review the **audit log** and data-governance settings.

**Works with.** Every module (it governs what they show and what they're called). All changes are audit-logged.

---

## Cross-cutting at a glance

| Capability | Where | Note |
|------------|-------|------|
| Sign in / sessions | `/login`, `/profile` | Lockout after repeated failures; secure refresh-token sessions |
| Role-aware navigation | Everywhere | Missing menu = permission or disabled module |
| Configurable labels | Admin → Terminology | Labels may differ from this guide; behaviour is identical |
| Human-in-the-loop AI | AI Actions / Approvals | "Pending review" outputs aren't usable until approved |
| Grounded answers | Knowledge Base / RAG | AI cites sources and escalates instead of guessing |
| Auditability | Admin → Audit | Logins, denials, exports, config, AI runs |

---

*Companion: see the **Persona-Wise Workflow Guide** for end-to-end, step-by-step tasks per role, each with a ready-to-use demo login. Source of record: `docs/user-guides/USER_MANUAL.md` and the [Documentation Index](../DOCUMENTATION_INDEX.md).*
